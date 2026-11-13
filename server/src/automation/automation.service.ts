import {
  ConflictException,
  Injectable,
  Logger,
  HttpException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { BillsService } from '../bills/bills.service';
import {
  lastCompletedPeriod,
  nextPeriodBoundaries,
} from '../bills/billing-schedule';
import { toISTDateString } from '../common/dates';
import {
  AutomationRun,
  AutomationRunDocument,
  AutomationSettings,
  AutomationSettingsDocument,
  Customer,
  CustomerDocument,
} from '../core/schemas';
import { MessService } from '../mess/mess.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';

const CUSTOMER_PAGE = 100;
const LEASE_MS = 5 * 60 * 1000;
const MAX_FAILURES_STORED = 25;
const num = (v: string | undefined, d: number) => {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : d;
};

export interface RunSummary {
  runId: string;
  trigger: 'SCHEDULED' | 'MANUAL';
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  processedCustomers: number;
  created: number;
  skippedAlreadyBilled: number;
  skippedNothingToBill: number;
  failed: number;
  hasMore: boolean;
  errorSummary: string | null;
  billIds: string[];
  failures: Array<{
    customerId: string;
    customerName?: string;
    reason: string;
  }>;
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectModel(AutomationSettings.name)
    private readonly settingsModel: Model<AutomationSettingsDocument>,
    @InjectModel(AutomationRun.name)
    private readonly runModel: Model<AutomationRunDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    private readonly bills: BillsService,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
    private readonly messService: MessService,
  ) {}

  // ------------------------------------------------------------------ settings

  private async ensureSettings(ownerId: string, messId: string) {
    return this.settingsModel
      .findOneAndUpdate(
        { ownerId },
        {
          $setOnInsert: {
            messId,
            enabled: false,
            timezone: 'Asia/Kolkata',
            pushEnabled: false,
            billingNotifications: true,
          },
        },
        { upsert: true, new: true },
      )
      .lean();
  }

  async getSettings(ownerId: string) {
    const messId = await this.messService.getMessIdForOwner(ownerId);
    const s = await this.ensureSettings(ownerId, messId);
    const schedulerConfigured =
      !!process.env.BILLING_JOB_SECRET &&
      process.env.BILLING_JOB_SECRET.length >= 16;

    let status:
      | 'DISABLED'
      | 'AWAITING_CONFIGURATION'
      | 'AWAITING_FIRST_RUN'
      | 'ERROR'
      | 'ACTIVE';
    if (!s.enabled) status = 'DISABLED';
    else if (!schedulerConfigured) status = 'AWAITING_CONFIGURATION';
    else if (!s.lastScheduledRunAt) status = 'AWAITING_FIRST_RUN';
    else if (s.lastRun?.status === 'FAILED') status = 'ERROR';
    else status = 'ACTIVE';

    const b = nextPeriodBoundaries(new Date());
    return {
      enabled: s.enabled,
      timezone: s.timezone,
      status,
      schedulerConfigured,
      lastScheduledRunAt: s.lastScheduledRunAt ?? null,
      lastRun: s.lastRun ?? null,
      // The exact run time is owned by the external scheduler, so we do not claim one. We expose
      // when the next billing periods close (when new bills first become due).
      nextRunAt: null,
      nextPeriodCloses: {
        weekly: new Date(b.weekly).toISOString(),
        monthly: new Date(b.monthly).toISOString(),
      },
    };
  }

  async setEnabled(ownerId: string, enabled: boolean) {
    const messId = await this.messService.getMessIdForOwner(ownerId);
    await this.ensureSettings(ownerId, messId);
    // Only the flag changes: customer billing frequencies are never touched.
    await this.settingsModel.updateOne({ ownerId }, { $set: { enabled } });
    return this.getSettings(ownerId);
  }

  async history(ownerId: string, limit = 20) {
    const messId = await this.messService.getMessIdForOwner(ownerId);
    return this.runModel
      .find({ messId })
      .select('-failures.reason -_id -__v')
      .sort({ startedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .lean();
  }

  // ------------------------------------------------------------------ leasing

  private async acquireLease(messId: string, runId: string): Promise<boolean> {
    const now = new Date();
    const res = await this.settingsModel.findOneAndUpdate(
      {
        messId,
        $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }],
      },
      {
        $set: {
          lockedUntil: new Date(now.getTime() + LEASE_MS),
          lockedBy: runId,
        },
      },
      { new: true },
    );
    return !!res;
  }

  private async releaseLease(messId: string, runId: string) {
    await this.settingsModel.updateOne(
      { messId, lockedBy: runId },
      { $set: { lockedUntil: null, lockedBy: null } },
    );
  }

  // ------------------------------------------------------------------ manual

  /** Manual "Generate Bills Now". Independent of the automation toggle. */
  async generateNow(ownerId: string, opts: { dryRun?: boolean } = {}) {
    const messId = await this.messService.getMessIdForOwner(ownerId);
    await this.ensureSettings(ownerId, messId);
    if (opts.dryRun) return this.dryRun(messId);

    const summary = await this.runForMess({
      messId,
      ownerId,
      trigger: 'MANUAL',
      requireEnabled: false,
    });
    if (summary.status === 'SKIPPED') {
      throw new ConflictException('A bill run is already in progress');
    }
    return summary;
  }

  /** Counts what a real run would look at, without creating anything. */
  private async dryRun(messId: string) {
    const now = new Date();
    let eligible = 0;
    let alreadyBilled = 0;
    let cursor: string | null = null;
    for (;;) {
      const page = await this.customerPage(messId, cursor);
      if (page.length === 0) break;
      for (const c of page) {
        const period = lastCompletedPeriod(c.billingType, now);
        if (!period || new Date(c.createdAt ?? 0) > period.end) continue;
        eligible++;
        if (
          await this.bills.periodAlreadyBilled(
            messId,
            String(c._id),
            c.billingType,
            period.start,
            period.end,
            period.key,
          )
        )
          alreadyBilled++;
      }
      cursor = String(page[page.length - 1]._id);
      if (page.length < CUSTOMER_PAGE) break;
    }
    return {
      dryRun: true as const,
      eligibleCustomers: eligible,
      alreadyBilled,
      toProcess: eligible - alreadyBilled,
    };
  }

  // ------------------------------------------------------------------ core run

  private customerPage(messId: string, afterId: string | null) {
    return this.customerModel
      .find({
        messId,
        isActive: true,
        billingType: { $in: ['WEEKLY', 'MONTHLY'] },
        ...(afterId ? { _id: { $gt: afterId } } : {}),
      })
      .sort({ _id: 1 })
      .limit(CUSTOMER_PAGE)
      .lean();
  }

  private async withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
    let last: unknown;
    for (let i = 1; i <= tries; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        // Business errors (404/400/409) are final; only infrastructure errors are retried.
        if (e instanceof HttpException || i === tries) break;
        await new Promise((r) => setTimeout(r, 100 * i));
      }
    }
    throw last;
  }

  /**
   * Processes every due customer of ONE mess through the shared bill service.
   * Safe to retry and to run concurrently (lease + unique period index).
   */
  async runForMess(args: {
    messId: string;
    ownerId: string;
    trigger: 'SCHEDULED' | 'MANUAL';
    requireEnabled: boolean;
    maxCustomers?: number;
    deadline?: number;
  }): Promise<RunSummary> {
    const { messId, ownerId, trigger } = args;
    const runId = randomUUID();
    const startedAt = new Date();
    const maxCustomers =
      args.maxCustomers ?? num(process.env.BILLING_MAX_CUSTOMERS_PER_RUN, 1000);

    const base: RunSummary = {
      runId,
      trigger,
      status: 'SUCCESS',
      processedCustomers: 0,
      created: 0,
      skippedAlreadyBilled: 0,
      skippedNothingToBill: 0,
      failed: 0,
      hasMore: false,
      errorSummary: null,
      billIds: [],
      failures: [],
    };

    const settings = await this.settingsModel.findOne({ messId }).lean();
    if (args.requireEnabled && !settings?.enabled) {
      // Automation off: create nothing. Record the outcome once, not on every cron tick.
      if (
        settings?.lastRun?.status !== 'SKIPPED' ||
        settings?.lastRun?.errorSummary !== 'Automatic generation is disabled'
      ) {
        await this.recordSkipped(
          messId,
          trigger,
          runId,
          startedAt,
          'Automatic generation is disabled',
          settings ? true : false,
        );
      }
      return {
        ...base,
        status: 'SKIPPED',
        errorSummary: 'Automatic generation is disabled',
      };
    }

    if (!(await this.acquireLease(messId, runId))) {
      await this.recordSkipped(
        messId,
        trigger,
        runId,
        startedAt,
        'Another run is in progress',
        false,
      );
      return {
        ...base,
        status: 'SKIPPED',
        errorSummary: 'Another run is in progress',
      };
    }

    await this.runModel.create({
      runId,
      messId,
      trigger,
      status: 'RUNNING',
      startedAt,
    });

    const names = new Map<string, string>();
    const now = new Date();
    const failuresStored: RunSummary['failures'] = [];

    try {
      let cursor: string | null = null;
      outer: for (;;) {
        const page = await this.customerPage(messId, cursor);
        if (page.length === 0) break;
        for (const c of page) {
          if (
            base.processedCustomers >= maxCustomers ||
            (args.deadline && Date.now() > args.deadline)
          ) {
            base.hasMore = true;
            break outer;
          }
          base.processedCustomers++;
          const customerId = String(c._id);
          names.set(customerId, c.name);
          const period = lastCompletedPeriod(c.billingType, now);
          // Not a customer yet during that period -> nothing to bill, and no failure.
          if (!period || new Date(c.createdAt ?? 0) > period.end) {
            base.skippedNothingToBill++;
            continue;
          }
          try {
            const r = await this.withRetry(() =>
              this.bills.generateForPeriod(messId, customerId, period, {
                source: trigger === 'SCHEDULED' ? 'AUTOMATIC' : 'MANUAL',
                runId,
              }),
            );
            if (r.outcome === 'CREATED') {
              base.created++;
              base.billIds.push(String(r.bill._id));
            } else if (r.outcome === 'ALREADY_BILLED')
              base.skippedAlreadyBilled++;
            else base.skippedNothingToBill++;
          } catch (e) {
            // One customer's failure never stops the others.
            base.failed++;
            const reason =
              e instanceof HttpException
                ? e.message
                : 'Unexpected error while billing';
            this.logger.warn(
              `Billing failed for a customer in run ${runId}: ${reason}`,
            );
            if (failuresStored.length < MAX_FAILURES_STORED) {
              failuresStored.push({
                customerId,
                customerName: names.get(customerId),
                reason: reason.slice(0, 200),
              });
            }
          }
        }
        cursor = String(page[page.length - 1]._id);
        if (page.length < CUSTOMER_PAGE) break;
      }
    } catch (e) {
      base.failed++;
      base.errorSummary = 'Run aborted by an unexpected error';
      this.logger.error(`Run ${runId} aborted: ${(e as Error).message}`);
    }

    base.failures = failuresStored;
    const succeeded =
      base.created + base.skippedAlreadyBilled + base.skippedNothingToBill;
    base.status =
      base.failed === 0 ? 'SUCCESS' : succeeded > 0 ? 'PARTIAL' : 'FAILED';
    if (base.failed > 0 && !base.errorSummary) {
      base.errorSummary = `${base.failed} customer(s) could not be billed`;
    }

    await this.finishRun(messId, base);
    await this.releaseLease(messId, runId);

    if (trigger === 'SCHEDULED') await this.notifyOwner(ownerId, messId, base);
    return base;
  }

  private async recordSkipped(
    messId: string,
    trigger: 'SCHEDULED' | 'MANUAL',
    runId: string,
    startedAt: Date,
    reason: string,
    updateSettings: boolean,
  ) {
    const finishedAt = new Date();
    await this.runModel.create({
      runId,
      messId,
      trigger,
      status: 'SKIPPED',
      startedAt,
      finishedAt,
      errorSummary: reason,
    });
    if (updateSettings) {
      await this.settingsModel.updateOne(
        { messId },
        {
          $set: {
            lastRun: {
              runId,
              status: 'SKIPPED',
              finishedAt,
              created: 0,
              skipped: 0,
              failed: 0,
              errorSummary: reason,
            },
            ...(trigger === 'SCHEDULED'
              ? { lastScheduledRunAt: finishedAt }
              : {}),
          },
        },
      );
    }
  }

  private async finishRun(messId: string, r: RunSummary) {
    const finishedAt = new Date();
    await this.runModel.updateOne(
      { runId: r.runId },
      {
        $set: {
          status: r.status,
          finishedAt,
          processedCustomers: r.processedCustomers,
          created: r.created,
          skippedAlreadyBilled: r.skippedAlreadyBilled,
          skippedNothingToBill: r.skippedNothingToBill,
          failed: r.failed,
          errorSummary: r.errorSummary,
          failures: r.failures.map((f) => ({
            customerId: f.customerId,
            periodKey: '',
            reason: f.reason,
          })),
          billIds: r.billIds,
        },
      },
    );
    await this.settingsModel.updateOne(
      { messId },
      {
        $set: {
          lastRun: {
            runId: r.runId,
            status: r.status,
            finishedAt,
            created: r.created,
            skipped: r.skippedAlreadyBilled + r.skippedNothingToBill,
            failed: r.failed,
            errorSummary: r.errorSummary,
          },
          ...(r.trigger === 'SCHEDULED'
            ? { lastScheduledRunAt: finishedAt }
            : {}),
        },
      },
    );
  }

  // ------------------------------------------------------------------ notifications

  /**
   * Bills are already committed. Notification persistence/push problems are logged and swallowed:
   * they can never fail or roll back billing.
   */
  private async notifyOwner(ownerId: string, messId: string, r: RunSummary) {
    const day = toISTDateString(new Date());
    try {
      if (r.created > 0) {
        const eventKey = `auto-bills:${messId}:${day}`;
        const text = (n: number) =>
          `${n} bill${n === 1 ? ' was' : 's were'} generated automatically.`;
        const res = await this.notifications.create({
          ownerId,
          messId,
          type: 'AUTO_BILLS_GENERATED',
          category: 'billing',
          title: 'Bills generated',
          message: text(r.created),
          relatedType: r.created === 1 ? 'bill' : 'bills',
          relatedId: r.created === 1 ? r.billIds[0] : null,
          eventKey,
          metadata: { billCount: r.created },
          push: true,
        });
        if (!res.created) {
          // Same-day follow-up run (e.g. after a partial failure) that created more bills:
          // fold them into the existing digest instead of creating a duplicate notification.
          await this.notifications.addToBillDigest(
            ownerId,
            eventKey,
            r.created,
            text,
          );
        }
      }
      if (r.failed > 0) {
        await this.notifications.create({
          ownerId,
          messId,
          type: 'AUTOMATION_ERROR',
          category: 'billing',
          title: 'Automatic billing needs attention',
          message: `${r.failed} customer${r.failed === 1 ? '' : 's'} could not be billed automatically. Open Settings to review.`,
          relatedType: 'automation',
          eventKey: `auto-error:${messId}:${day}`,
          metadata: { failed: r.failed },
          push: true,
        });
      }
    } catch (e) {
      this.logger.warn(
        `Notification step failed (bills unaffected): ${(e as Error).message}`,
      );
    }
  }

  // ------------------------------------------------------------------ scheduled job

  /**
   * Entry point for the external scheduler. Bounded per invocation (mess count and time budget);
   * idempotent, so the cron can simply run again to continue or recover.
   */
  async runScheduled(opts: { dryRun?: boolean } = {}) {
    const jobId = randomUUID();
    const startedAt = new Date();
    const maxMesses = num(process.env.BILLING_JOB_MAX_MESSES, 100);
    const deadline =
      Date.now() + num(process.env.BILLING_JOB_TIME_BUDGET_MS, 5 * 60 * 1000);

    const [enabled, disabled] = await Promise.all([
      this.settingsModel.countDocuments({ enabled: true }),
      this.settingsModel.countDocuments({ enabled: false }),
    ]);

    if (opts.dryRun) {
      return {
        jobId,
        dryRun: true,
        messesEnabled: enabled,
        messesDisabled: disabled,
      };
    }

    // Least-recently-run first, so a bounded batch still rotates fairly through everyone.
    const targets = await this.settingsModel
      .find({ enabled: true })
      .sort({ lastScheduledRunAt: 1 })
      .limit(maxMesses)
      .lean();

    // Disabled owners get exactly one "skipped" record so Settings can show a clear outcome.
    const disabledTargets = await this.settingsModel
      .find({
        enabled: false,
        'lastRun.errorSummary': { $ne: 'Automatic generation is disabled' },
      })
      .limit(maxMesses)
      .lean();

    const totals = {
      created: 0,
      skippedAlreadyBilled: 0,
      skippedNothingToBill: 0,
      failed: 0,
      processedCustomers: 0,
    };
    let messesProcessed = 0;
    let hasMore = enabled > targets.length;

    for (const t of targets) {
      if (Date.now() > deadline) {
        hasMore = true;
        break;
      }
      try {
        const r = await this.runForMess({
          messId: t.messId,
          ownerId: t.ownerId,
          trigger: 'SCHEDULED',
          requireEnabled: true,
          deadline,
        });
        messesProcessed++;
        totals.created += r.created;
        totals.skippedAlreadyBilled += r.skippedAlreadyBilled;
        totals.skippedNothingToBill += r.skippedNothingToBill;
        totals.failed += r.failed;
        totals.processedCustomers += r.processedCustomers;
        if (r.hasMore) hasMore = true;
      } catch (e) {
        // One mess failing must not stop the rest.
        totals.failed++;
        this.logger.error(
          `Scheduled run failed for a mess: ${(e as Error).message}`,
        );
      }
    }

    for (const t of disabledTargets) {
      try {
        await this.runForMess({
          messId: t.messId,
          ownerId: t.ownerId,
          trigger: 'SCHEDULED',
          requireEnabled: true,
        });
      } catch (e) {
        this.logger.warn(
          `Could not record skipped run: ${(e as Error).message}`,
        );
      }
    }

    let receipts = { checked: 0, deactivated: 0 };
    try {
      receipts = await this.push.processReceipts();
    } catch {
      /* non-fatal */
    }

    return {
      jobId,
      startedAt,
      finishedAt: new Date(),
      status: totals.failed === 0 ? 'SUCCESS' : 'PARTIAL',
      messesProcessed,
      messesDisabled: disabled,
      hasMore,
      ...totals,
      pushReceipts: receipts,
    };
  }
}
