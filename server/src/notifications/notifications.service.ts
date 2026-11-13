import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AutomationSettings,
  AutomationSettingsDocument,
  Notification,
  NotificationCategory,
  NotificationDocument,
  NotificationType,
  PushToken,
  PushTokenDocument,
} from '../core/schemas';
import { MessService } from '../mess/mess.service';
import { PushService } from './push.service';

export interface CreateNotificationInput {
  ownerId: string;
  messId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  relatedType?: 'bill' | 'bills' | 'automation' | null;
  relatedId?: string | null;
  /** Idempotency key: the same (ownerId, eventKey) can only ever produce one notification. */
  eventKey?: string | null;
  metadata?: Record<string, unknown>;
  /** Attempt push delivery (in addition to persisting). */
  push?: boolean;
}

const isDup = (e: unknown) => (e as { code?: number })?.code === 11000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly model: Model<NotificationDocument>,
    @InjectModel(PushToken.name)
    private readonly tokenModel: Model<PushTokenDocument>,
    @InjectModel(AutomationSettings.name)
    private readonly settingsModel: Model<AutomationSettingsDocument>,
    private readonly push: PushService,
    private readonly messService: MessService,
  ) {}

  // ---------------------------------------------------------------- creation (internal)

  /**
   * Persists a notification exactly once per (ownerId, eventKey), then attempts push delivery
   * independently. Never throws because of push; a persistence error other than a duplicate key
   * is surfaced to the caller (who must treat it as non-fatal to billing).
   */
  async create(
    input: CreateNotificationInput,
  ): Promise<{ notification: Record<string, any> | null; created: boolean }> {
    let doc: NotificationDocument;
    try {
      doc = await this.model.create({
        ownerId: input.ownerId,
        messId: input.messId,
        type: input.type,
        category: input.category,
        title: input.title,
        message: input.message,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        eventKey: input.eventKey ?? null,
        metadata: input.metadata ?? {},
      });
    } catch (e) {
      if (isDup(e)) {
        const existing = await this.model
          .findOne({ ownerId: input.ownerId, eventKey: input.eventKey })
          .lean();
        return { notification: existing, created: false };
      }
      throw e;
    }

    if (input.push) await this.deliverPush(doc);
    return { notification: doc.toObject(), created: true };
  }

  /** Adds `extra` bills to an existing digest notification (owner-scoped) and rewrites its text. */
  async addToBillDigest(
    ownerId: string,
    eventKey: string,
    extra: number,
    text: (total: number) => string,
  ) {
    const existing = await this.model.findOne({ ownerId, eventKey }).lean();
    if (!existing) return;
    const total =
      ((existing.metadata as { billCount?: number })?.billCount ?? 0) + extra;
    await this.model.updateOne(
      { _id: existing._id, ownerId },
      {
        $set: {
          message: text(total),
          'metadata.billCount': total,
          relatedType: 'bills',
          relatedId: null,
        },
      },
    );
  }

  /** Push is attempted after persistence and its result recorded; failures never propagate. */
  private async deliverPush(doc: NotificationDocument) {
    try {
      const settings = await this.settingsModel
        .findOne({ ownerId: doc.ownerId })
        .lean();
      const allowed =
        !!settings?.pushEnabled &&
        (doc.category !== 'billing' || settings.billingNotifications !== false);
      if (!allowed) {
        return this.recordPush(doc, 'SKIPPED', 'disabled_by_owner', []);
      }
      const tokens = await this.push.activeTokens(doc.ownerId);
      const outcome = await this.push.send(tokens, {
        title: doc.title,
        body: doc.message,
        // Ids and routing only; no customer names, phones or amounts.
        data: {
          notificationId: String(doc._id),
          type: doc.type,
          relatedType: doc.relatedType ?? null,
          relatedId: doc.relatedId ?? null,
        },
      });
      await this.recordPush(
        doc,
        outcome.status,
        outcome.reason ?? null,
        outcome.tickets,
      );
    } catch (e) {
      this.logger.warn(`Push delivery error: ${(e as Error).message}`);
      await this.recordPush(doc, 'FAILED', 'unexpected_error', []).catch(
        () => undefined,
      );
    }
  }

  private recordPush(
    doc: NotificationDocument,
    status: 'SENT' | 'FAILED' | 'SKIPPED',
    reason: string | null,
    tickets: Array<{ ticketId: string; tokenId: string }>,
  ) {
    return this.model.updateOne(
      { _id: doc._id },
      {
        $set: {
          'push.status': status,
          'push.reason': reason,
          'push.attemptedAt': new Date(),
          'push.tickets': tickets,
          'push.receiptsChecked': status !== 'SENT',
        },
      },
    );
  }

  // ---------------------------------------------------------------- owner-facing reads/writes

  async list(ownerId: string, opts: { limit?: number; before?: string } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const query: Record<string, unknown> = { ownerId };
    if (opts.before) query._id = { $lt: opts.before };
    const rows = await this.model
      .find(query)
      .select('-push.tickets')
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
      unreadCount: await this.unreadCount(ownerId),
    };
  }

  async unreadCount(ownerId: string): Promise<number> {
    return this.model.countDocuments({ ownerId, isRead: false });
  }

  /** Scoped by ownerId in the filter itself, so another owner's id simply 404s. */
  async markRead(ownerId: string, id: string) {
    const n = await this.model
      .findOneAndUpdate(
        { _id: id, ownerId },
        [
          {
            $set: {
              isRead: true,
              readAt: { $ifNull: ['$readAt', '$$NOW'] },
            },
          },
        ],
        { new: true },
      )
      .select('-push.tickets')
      .lean();
    if (!n) throw new NotFoundException('Notification not found');
    return { notification: n, unreadCount: await this.unreadCount(ownerId) };
  }

  async markAllRead(ownerId: string) {
    const res = await this.model.updateMany(
      { ownerId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return { updated: res.modifiedCount, unreadCount: 0 };
  }

  // ---------------------------------------------------------------- preferences

  async getPreferences(ownerId: string) {
    const [settings, devices] = await Promise.all([
      this.settingsModel.findOne({ ownerId }).lean(),
      this.tokenModel.countDocuments({ ownerId, isActive: true }),
    ]);
    return {
      pushEnabled: settings?.pushEnabled ?? false,
      billingNotifications: settings?.billingNotifications ?? true,
      registeredDevices: devices,
    };
  }

  async updatePreferences(
    ownerId: string,
    patch: { pushEnabled?: boolean; billingNotifications?: boolean },
  ) {
    const messId = await this.messService.getMessIdForOwner(ownerId);
    const $set: Record<string, boolean> = {};
    if (patch.pushEnabled !== undefined) $set.pushEnabled = patch.pushEnabled;
    if (patch.billingNotifications !== undefined)
      $set.billingNotifications = patch.billingNotifications;
    await this.settingsModel.findOneAndUpdate(
      { ownerId },
      {
        ...(Object.keys($set).length ? { $set } : {}),
        $setOnInsert: { messId, enabled: false, timezone: 'Asia/Kolkata' },
      },
      { upsert: true, new: true },
    );
    return this.getPreferences(ownerId);
  }

  // ---------------------------------------------------------------- push token lifecycle

  /**
   * Registers/refreshes a device token for the authenticated owner. Tokens are unique, so if a
   * device switches accounts the token moves to the new owner atomically; a refreshed token for
   * the same (owner, device) replaces the old one. The token is an address, never credentials.
   */
  async registerToken(
    ownerId: string,
    dto: { token: string; deviceId: string; platform?: string },
    retry = true,
  ): Promise<{ registered: true }> {
    try {
      await this.tokenModel.deleteMany({
        ownerId,
        deviceId: dto.deviceId,
        token: { $ne: dto.token },
      });
      await this.tokenModel.findOneAndUpdate(
        { token: dto.token },
        {
          $set: {
            ownerId,
            deviceId: dto.deviceId,
            platform: dto.platform ?? 'unknown',
            isActive: true,
            lastSeenAt: new Date(),
            deactivatedAt: null,
            deactivatedReason: null,
          },
        },
        { upsert: true },
      );
    } catch (e) {
      if (isDup(e) && retry) return this.registerToken(ownerId, dto, false);
      throw e;
    }
    return { registered: true };
  }

  /** Called on logout / permission revoked. Owner-scoped: cannot remove another owner's token. */
  async unregisterToken(ownerId: string, deviceId: string) {
    const res = await this.tokenModel.deleteMany({ ownerId, deviceId });
    return { removed: res.deletedCount };
  }
}
