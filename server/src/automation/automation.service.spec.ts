import { ConflictException } from '@nestjs/common';
import { AutomationService } from './automation.service';

const chain = (v: any) => {
  const c: any = {
    sort: () => c,
    limit: () => c,
    select: () => c,
    lean: () => Promise.resolve(v),
    then: (r: any, j: any) => Promise.resolve(v).then(r, j),
  };
  return c;
};

// A fixed "now" just after Monday 2026-10-12 00:00 IST so last-week and last-month are both due.
const NOW = new Date('2026-10-12T01:00:00+05:30');

const weekly = (id: string, extra = {}) => ({
  _id: id,
  name: `W-${id}`,
  billingType: 'WEEKLY',
  createdAt: new Date('2026-01-01'),
  ...extra,
});
const monthly = (id: string, extra = {}) => ({
  _id: id,
  name: `M-${id}`,
  billingType: 'MONTHLY',
  createdAt: new Date('2026-01-01'),
  ...extra,
});

function make(
  opts: {
    settings?: any;
    customers?: any[];
    lease?: boolean;
    generate?: (customerId: string, period: any) => Promise<any>;
    notifyThrows?: boolean;
  } = {},
) {
  const settings =
    opts.settings === undefined
      ? {
          ownerId: 'o1',
          messId: 'm1',
          enabled: true,
          timezone: 'Asia/Kolkata',
          lastRun: null,
        }
      : opts.settings;

  const settingsModel: any = {
    findOne: jest.fn(() => chain(settings)),
    findOneAndUpdate: jest.fn((_f: any, u: any) =>
      u.$setOnInsert
        ? chain(settings ?? { enabled: false })
        : chain(opts.lease === false ? null : { ok: true }),
    ),
    updateOne: jest.fn().mockResolvedValue({}),
    countDocuments: jest.fn().mockResolvedValue(1),
    find: jest.fn(() => chain([{ ownerId: 'o1', messId: 'm1' }])),
  };
  const runModel: any = {
    create: jest.fn().mockResolvedValue({}),
    updateOne: jest.fn().mockResolvedValue({}),
    find: jest.fn(() => chain([])),
  };
  const customerModel: any = {
    find: jest.fn(() => chain(opts.customers ?? [])),
  };
  const gen =
    opts.generate ??
    (async (id: string) => ({
      outcome: 'CREATED',
      bill: { _id: `bill-${id}` },
    }));
  // Real signature is (messId, customerId, period, ctx); tests only care about customerId + period.
  const generateForPeriod = jest.fn((_m: string, id: string, period: any) =>
    gen(id, period),
  );
  const bills: any = {
    generateForPeriod,
    periodAlreadyBilled: jest.fn().mockResolvedValue(false),
  };
  const notifications: any = {
    create: jest.fn(async () => {
      if (opts.notifyThrows) throw new Error('db down');
      return { notification: {}, created: true };
    }),
    addToBillDigest: jest.fn(),
  };
  const push: any = {
    processReceipts: jest
      .fn()
      .mockResolvedValue({ checked: 0, deactivated: 0 }),
  };
  const messService: any = {
    getMessIdForOwner: jest.fn().mockResolvedValue('m1'),
  };

  // Freeze only the clock; retry backoff must still be able to use real timers.
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['setTimeout', 'setImmediate', 'nextTick'],
  });
  const svc = new AutomationService(
    settingsModel,
    runModel,
    customerModel,
    bills,
    notifications,
    push,
    messService,
  );
  return {
    svc,
    settingsModel,
    runModel,
    customerModel,
    generateForPeriod,
    notifications,
    push,
    bills,
  };
}

afterEach(() => jest.useRealTimers());

const scheduled = (svc: AutomationService, over = {}) =>
  svc.runForMess({
    messId: 'm1',
    ownerId: 'o1',
    trigger: 'SCHEDULED',
    requireEnabled: true,
    ...over,
  });

describe('scheduled run: automation setting', () => {
  it('disabled: creates NO bills, never touches the bill service, and records a clear outcome', async () => {
    const { svc, generateForPeriod, runModel } = make({
      settings: { ownerId: 'o1', messId: 'm1', enabled: false, lastRun: null },
      customers: [weekly('c1')],
    });
    const r = await scheduled(svc);
    expect(r.status).toBe('SKIPPED');
    expect(r.errorSummary).toBe('Automatic generation is disabled');
    expect(generateForPeriod).not.toHaveBeenCalled();
    expect(runModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SKIPPED',
        trigger: 'SCHEDULED',
        errorSummary: 'Automatic generation is disabled',
      }),
    );
  });

  it('disabled: does not write a fresh skipped record on every cron tick', async () => {
    const { svc, runModel } = make({
      settings: {
        ownerId: 'o1',
        messId: 'm1',
        enabled: false,
        lastRun: {
          status: 'SKIPPED',
          errorSummary: 'Automatic generation is disabled',
        },
      },
    });
    await scheduled(svc);
    expect(runModel.create).not.toHaveBeenCalled();
  });

  it('no settings at all (never configured): nothing is generated', async () => {
    const { svc, generateForPeriod } = make({
      settings: null,
      customers: [weekly('c1')],
    });
    expect((await scheduled(svc)).status).toBe('SKIPPED');
    expect(generateForPeriod).not.toHaveBeenCalled();
  });
});

describe('scheduled run: due periods per customer frequency', () => {
  it('bills each customer for THEIR OWN last completed period', async () => {
    const { svc, generateForPeriod } = make({
      customers: [weekly('w1'), monthly('m1')],
    });
    const r = await scheduled(svc);
    expect(r.created).toBe(2);
    const keys = Object.fromEntries(
      generateForPeriod.mock.calls.map((c) => [c[1], c[2].key]),
    );
    expect(keys).toEqual({ w1: 'WEEKLY:2026-10-05', m1: 'MONTHLY:2026-09' });
  });

  it('passes source AUTOMATIC and the run id into billing', async () => {
    const { svc, generateForPeriod } = make({ customers: [weekly('w1')] });
    const r = await scheduled(svc);
    expect(generateForPeriod).toHaveBeenCalledWith(
      'm1',
      'w1',
      expect.anything(),
      { source: 'AUTOMATIC', runId: r.runId },
    );
  });

  it('only queries active weekly/monthly customers of this mess (pay-per-meal / inactive excluded)', async () => {
    const { svc, customerModel } = make({ customers: [] });
    await scheduled(svc);
    expect(customerModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        messId: 'm1',
        isActive: true,
        billingType: { $in: ['WEEKLY', 'MONTHLY'] },
      }),
    );
  });

  it('a customer who joined after the period ended is not billed for it (and is not a failure)', async () => {
    const { svc, generateForPeriod } = make({
      customers: [
        weekly('new', { createdAt: new Date('2026-10-12T00:30:00+05:30') }),
      ], // joined AFTER Sun 23:59 IST
    });
    const r = await scheduled(svc);
    expect(generateForPeriod).not.toHaveBeenCalled();
    expect(r.failed).toBe(0);
    expect(r.skippedNothingToBill).toBe(1);
  });

  it('a customer who joined mid-period IS billed for that period (no proration)', async () => {
    const { svc, generateForPeriod } = make({
      customers: [
        weekly('mid', { createdAt: new Date('2026-10-07T10:00:00+05:30') }),
      ],
    });
    await scheduled(svc);
    expect(generateForPeriod).toHaveBeenCalledTimes(1);
  });
});

describe('scheduled run: idempotency and failure isolation', () => {
  it('an already-billed period is counted as skipped, not created and not failed', async () => {
    const { svc } = make({
      customers: [weekly('w1')],
      generate: async () => ({ outcome: 'ALREADY_BILLED' }),
    });
    const r = await scheduled(svc);
    expect(r).toMatchObject({
      created: 0,
      skippedAlreadyBilled: 1,
      failed: 0,
      status: 'SUCCESS',
    });
  });

  it('running twice yields bills once: the second pass only sees ALREADY_BILLED', async () => {
    const billed = new Set<string>();
    const generate = async (id: string) => {
      if (billed.has(id)) return { outcome: 'ALREADY_BILLED' };
      billed.add(id);
      return { outcome: 'CREATED', bill: { _id: `b-${id}` } };
    };
    const { svc } = make({ customers: [weekly('w1'), weekly('w2')], generate });
    const first = await scheduled(svc);
    const second = await scheduled(svc);
    expect(first.created).toBe(2);
    expect(second).toMatchObject({ created: 0, skippedAlreadyBilled: 2 });
  });

  it("one customer's failure does not stop the others, and the run is PARTIAL", async () => {
    const { svc, generateForPeriod } = make({
      customers: [weekly('a'), weekly('bad'), weekly('c')],
      generate: async (id) => {
        if (id === 'bad') throw new Error('boom: secret internal detail');
        return { outcome: 'CREATED', bill: { _id: `b-${id}` } };
      },
    });
    const r = await scheduled(svc);
    expect(r.status).toBe('PARTIAL');
    expect(r.created).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.failures).toHaveLength(1);
    // reason is generic: internal error text must not reach the client or history
    expect(r.failures[0].reason).toBe('Unexpected error while billing');
    expect(JSON.stringify(r)).not.toContain('secret internal detail');
    // transient (non-HTTP) errors are retried a bounded number of times
    expect(
      generateForPeriod.mock.calls.filter((c) => c[1] === 'bad'),
    ).toHaveLength(3);
  });

  it('business (HTTP) errors are not retried', async () => {
    const { NotFoundException } = require('@nestjs/common');
    const { svc, generateForPeriod } = make({
      customers: [weekly('gone')],
      generate: async () => {
        throw new NotFoundException('Customer not found');
      },
    });
    const r = await scheduled(svc);
    expect(generateForPeriod).toHaveBeenCalledTimes(1);
    expect(r.failures[0].reason).toBe('Customer not found');
  });

  it('every customer failing yields FAILED', async () => {
    const { svc } = make({
      customers: [weekly('a')],
      generate: async () => {
        throw new Error('x');
      },
    });
    expect((await scheduled(svc)).status).toBe('FAILED');
  });

  it('records the run (RUNNING then final counts) and releases the lease', async () => {
    const { svc, runModel, settingsModel } = make({ customers: [weekly('a')] });
    const r = await scheduled(svc);
    expect(runModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ runId: r.runId, status: 'RUNNING' }),
    );
    expect(runModel.updateOne).toHaveBeenCalledWith(
      { runId: r.runId },
      {
        $set: expect.objectContaining({
          status: 'SUCCESS',
          created: 1,
          processedCustomers: 1,
        }),
      },
    );
    expect(settingsModel.updateOne).toHaveBeenCalledWith(
      { messId: 'm1', lockedBy: r.runId },
      { $set: { lockedUntil: null, lockedBy: null } },
    );
  });

  it('a concurrent run (lease held) is skipped and creates nothing', async () => {
    const { svc, generateForPeriod } = make({
      lease: false,
      customers: [weekly('a')],
    });
    const r = await scheduled(svc);
    expect(r.status).toBe('SKIPPED');
    expect(generateForPeriod).not.toHaveBeenCalled();
  });

  it('is bounded: stops at the per-run customer cap and reports hasMore', async () => {
    const { svc, generateForPeriod } = make({
      customers: [weekly('a'), weekly('b'), weekly('c')],
    });
    const r = await scheduled(svc, { maxCustomers: 2 });
    expect(generateForPeriod).toHaveBeenCalledTimes(2);
    expect(r.hasMore).toBe(true);
  });
});

describe('notifications from scheduled runs', () => {
  it('created bills -> persisted notification with a stable per-day event key, push attempted', async () => {
    const { svc, notifications } = make({
      customers: [weekly('a'), weekly('b')],
    });
    await scheduled(svc);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'AUTO_BILLS_GENERATED',
        ownerId: 'o1',
        eventKey: 'auto-bills:m1:2026-10-12',
        push: true,
        metadata: { billCount: 2 },
      }),
    );
  });

  it('push payload/notification never contains customer names', async () => {
    const { svc, notifications } = make({ customers: [weekly('a')] });
    await scheduled(svc);
    expect(JSON.stringify(notifications.create.mock.calls)).not.toContain(
      'W-a',
    );
  });

  it('same-day duplicate event folds into the existing notification instead of duplicating', async () => {
    const { svc, notifications } = make({ customers: [weekly('a')] });
    notifications.create.mockResolvedValueOnce({
      notification: { metadata: { billCount: 3 } },
      created: false,
    });
    await scheduled(svc);
    expect(notifications.addToBillDigest).toHaveBeenCalledWith(
      'o1',
      'auto-bills:m1:2026-10-12',
      1,
      expect.any(Function),
    );
  });

  it('nothing created -> no "bills generated" notification (retries stay silent)', async () => {
    const { svc, notifications } = make({
      customers: [weekly('a')],
      generate: async () => ({ outcome: 'ALREADY_BILLED' }),
    });
    await scheduled(svc);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('failures -> an attention-needed notification keyed per day', async () => {
    const { svc, notifications } = make({
      customers: [weekly('a')],
      generate: async () => {
        throw new Error('x');
      },
    });
    await scheduled(svc);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'AUTOMATION_ERROR',
        eventKey: 'auto-error:m1:2026-10-12',
      }),
    );
  });

  it('a notification-system failure never fails or undoes billing', async () => {
    const { svc } = make({ customers: [weekly('a')], notifyThrows: true });
    const r = await scheduled(svc);
    expect(r.status).toBe('SUCCESS');
    expect(r.created).toBe(1);
  });
});

describe('manual generation (Generate Bills Now)', () => {
  it('works while automatic generation is DISABLED', async () => {
    const { svc, generateForPeriod } = make({
      settings: { ownerId: 'o1', messId: 'm1', enabled: false, lastRun: null },
      customers: [weekly('a')],
    });
    const r: any = await svc.generateNow('o1');
    expect(r.created).toBe(1);
    expect(r.trigger).toBe('MANUAL');
    expect(generateForPeriod).toHaveBeenCalledWith(
      'm1',
      'a',
      expect.anything(),
      { source: 'MANUAL', runId: r.runId },
    );
  });

  it('repeating it creates no duplicates (second call only skips)', async () => {
    const billed = new Set<string>();
    const generate = async (id: string) =>
      billed.has(id)
        ? { outcome: 'ALREADY_BILLED' }
        : (billed.add(id), { outcome: 'CREATED', bill: { _id: id } });
    const { svc } = make({ customers: [weekly('a')], generate });
    expect(((await svc.generateNow('o1')) as any).created).toBe(1);
    expect(await svc.generateNow('o1')).toMatchObject({
      created: 0,
      skippedAlreadyBilled: 1,
    });
  });

  it('an overlapping tap while a run is in progress is rejected with 409', async () => {
    const { svc } = make({ lease: false, customers: [weekly('a')] });
    await expect(svc.generateNow('o1')).rejects.toThrow(ConflictException);
  });

  it('returns an honest summary including per-customer failures for the owner', async () => {
    const { svc } = make({
      customers: [weekly('ok'), weekly('bad')],
      generate: async (id) => {
        if (id === 'bad') throw new Error('x');
        return { outcome: 'CREATED', bill: { _id: 'b' } };
      },
    });
    const r: any = await svc.generateNow('o1');
    expect(r).toMatchObject({ status: 'PARTIAL', created: 1, failed: 1 });
    expect(r.failures[0]).toMatchObject({
      customerId: 'bad',
      customerName: 'W-bad',
    });
  });

  it('does not create in-app/push notifications (the owner is already looking at the result)', async () => {
    const { svc, notifications } = make({ customers: [weekly('a')] });
    await svc.generateNow('o1');
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('dryRun reports what is due without creating anything', async () => {
    const { svc, generateForPeriod, bills } = make({
      customers: [weekly('a'), weekly('b')],
    });
    bills.periodAlreadyBilled.mockResolvedValueOnce(true);
    const r = await svc.generateNow('o1', { dryRun: true });
    expect(r).toEqual({
      dryRun: true,
      eligibleCustomers: 2,
      alreadyBilled: 1,
      toProcess: 1,
    });
    expect(generateForPeriod).not.toHaveBeenCalled();
  });
});

describe('settings', () => {
  const env = process.env.BILLING_JOB_SECRET;
  afterEach(() => {
    if (env === undefined) delete process.env.BILLING_JOB_SECRET;
    else process.env.BILLING_JOB_SECRET = env;
  });

  it('enabled but scheduler secret missing => AWAITING_CONFIGURATION (never reported as active)', async () => {
    delete process.env.BILLING_JOB_SECRET;
    const { svc } = make();
    expect((await svc.getSettings('o1')).status).toBe('AWAITING_CONFIGURATION');
  });

  it('enabled + configured but no scheduled run seen yet => AWAITING_FIRST_RUN', async () => {
    process.env.BILLING_JOB_SECRET = 'x'.repeat(24);
    const { svc } = make();
    expect((await svc.getSettings('o1')).status).toBe('AWAITING_FIRST_RUN');
  });

  it('ACTIVE only after a scheduled run has actually happened', async () => {
    process.env.BILLING_JOB_SECRET = 'x'.repeat(24);
    const { svc } = make({
      settings: {
        ownerId: 'o1',
        messId: 'm1',
        enabled: true,
        timezone: 'Asia/Kolkata',
        lastScheduledRunAt: new Date(),
        lastRun: { status: 'SUCCESS' },
      },
    });
    expect((await svc.getSettings('o1')).status).toBe('ACTIVE');
  });

  it('disabled reports DISABLED and defaults to Asia/Kolkata', async () => {
    const { svc } = make({
      settings: {
        ownerId: 'o1',
        messId: 'm1',
        enabled: false,
        timezone: 'Asia/Kolkata',
      },
    });
    expect(await svc.getSettings('o1')).toMatchObject({
      status: 'DISABLED',
      timezone: 'Asia/Kolkata',
    });
  });

  it('toggling only changes the enabled flag (customer frequencies untouched)', async () => {
    const { svc, settingsModel, customerModel } = make();
    await svc.setEnabled('o1', false);
    expect(settingsModel.updateOne).toHaveBeenCalledWith(
      { ownerId: 'o1' },
      { $set: { enabled: false } },
    );
    expect(customerModel.find).not.toHaveBeenCalled();
  });
});

describe('runScheduled (job entry)', () => {
  it('dryRun reports counts and runs nothing', async () => {
    const { svc, generateForPeriod } = make({ customers: [weekly('a')] });
    expect(await svc.runScheduled({ dryRun: true })).toMatchObject({
      dryRun: true,
    });
    expect(generateForPeriod).not.toHaveBeenCalled();
  });

  it('processes enabled messes, then validates push receipts, and reports totals', async () => {
    const { svc, push } = make({ customers: [weekly('a')] });
    const r: any = await svc.runScheduled();
    expect(r).toMatchObject({
      status: 'SUCCESS',
      messesProcessed: 1,
      created: 1,
    });
    expect(push.processReceipts).toHaveBeenCalled();
  });

  it('a push-receipt failure does not fail the job', async () => {
    const { svc, push } = make({ customers: [weekly('a')] });
    push.processReceipts.mockRejectedValue(new Error('expo down'));
    expect(((await svc.runScheduled()) as any).status).toBe('SUCCESS');
  });
});
