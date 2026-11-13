import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  PushToken,
  PushTokenDocument,
} from '../core/schemas';

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const CHUNK = 100; // Expo's documented per-request limit
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

interface ExpoTicket {
  status?: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
}
interface ExpoSendResponse {
  data?: ExpoTicket[];
}
interface ExpoReceiptsResponse {
  data?: Record<string, ExpoTicket | undefined>;
}

/** A non-retryable HTTP failure (4xx other than 429). */
class PermanentHttpError extends Error {}

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface PushOutcome {
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  reason?: string;
  tickets: Array<{ ticketId: string; tokenId: string }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Thin Expo Push Service client. It NEVER throws to callers: a push failure must not fail bill
 * generation or remove the persisted in-app notification. Tokens and secrets are never logged.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectModel(PushToken.name)
    private readonly tokenModel: Model<PushTokenDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  private headers() {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    // Optional: only required if "Enhanced Security for Push Notifications" is on in the Expo account.
    if (process.env.EXPO_ACCESS_TOKEN) {
      h.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }
    return h;
  }

  /** POST with a timeout and bounded retries on transient failures (network, 429, 5xx). */
  private async post<T>(url: string, body: unknown): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`transient HTTP ${res.status}`);
        }
        if (!res.ok) {
          // 4xx other than 429 is not retryable.
          throw new PermanentHttpError(`HTTP ${res.status}`);
        }
        return (await res.json()) as T;
      } catch (e) {
        lastErr = e;
        if (e instanceof PermanentHttpError || attempt === MAX_ATTEMPTS) break;
        await sleep(250 * 2 ** (attempt - 1));
      }
    }
    throw lastErr;
  }

  /** Active tokens for an owner (all of their devices). */
  async activeTokens(ownerId: string) {
    return this.tokenModel.find({ ownerId, isActive: true }).lean();
  }

  async deactivate(tokenId: string, reason: string) {
    await this.tokenModel.updateOne(
      { _id: tokenId },
      {
        $set: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedReason: reason,
        },
      },
    );
  }

  async send(
    tokens: Array<{ _id: unknown; token: string }>,
    msg: PushMessage,
  ): Promise<PushOutcome> {
    if (tokens.length === 0) {
      return { status: 'SKIPPED', reason: 'no_active_tokens', tickets: [] };
    }
    const tickets: PushOutcome['tickets'] = [];
    let failedChunks = 0;

    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      try {
        const json = await this.post<ExpoSendResponse>(
          EXPO_SEND_URL,
          chunk.map((t) => ({
            to: t.token,
            title: msg.title,
            body: msg.body,
            data: msg.data,
            sound: 'default',
            channelId: 'billing',
            priority: 'high',
          })),
        );
        const results: ExpoTicket[] = Array.isArray(json?.data)
          ? json.data
          : [];
        for (let j = 0; j < chunk.length; j++) {
          const r = results[j];
          const tokenId = String(chunk[j]._id);
          if (r?.status === 'ok' && r.id) {
            tickets.push({ ticketId: r.id, tokenId });
          } else if (r?.details?.error === 'DeviceNotRegistered') {
            await this.deactivate(tokenId, 'DeviceNotRegistered');
          }
        }
      } catch (e) {
        failedChunks++;
        this.logger.warn(`Expo push send failed: ${(e as Error).message}`);
      }
    }

    if (tickets.length > 0) return { status: 'SENT', tickets };
    return {
      status: 'FAILED',
      reason: failedChunks > 0 ? 'delivery_error' : 'rejected_by_expo',
      tickets,
    };
  }

  /**
   * Validates receipts for notifications sent at least 15 minutes ago (Expo's guidance) and
   * deactivates tokens confirmed invalid. Safe to call repeatedly; bounded per call.
   */
  async processReceipts(
    limit = 50,
  ): Promise<{ checked: number; deactivated: number }> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const pending = await this.notificationModel
      .find({
        'push.status': 'SENT',
        'push.receiptsChecked': false,
        'push.attemptedAt': { $lte: cutoff },
      })
      .limit(limit)
      .lean();

    let checked = 0;
    let deactivated = 0;
    for (const n of pending) {
      const ids = (n.push.tickets ?? []).map((t) => t.ticketId);
      if (ids.length === 0) {
        await this.notificationModel.updateOne(
          { _id: n._id },
          { $set: { 'push.receiptsChecked': true } },
        );
        continue;
      }
      try {
        const json = await this.post<ExpoReceiptsResponse>(EXPO_RECEIPTS_URL, {
          ids,
        });
        const receipts = json?.data ?? {};
        for (const t of n.push.tickets) {
          const r = receipts[t.ticketId];
          if (
            r?.status === 'error' &&
            r.details?.error === 'DeviceNotRegistered'
          ) {
            await this.deactivate(t.tokenId, 'DeviceNotRegistered');
            deactivated++;
          }
        }
        // Receipts missing after 24h are gone from Expo; stop re-checking either way.
        const missing = ids.some((id) => !receipts[id]);
        const tooOld =
          n.push.attemptedAt &&
          Date.now() - new Date(n.push.attemptedAt).getTime() >
            24 * 3600 * 1000;
        if (!missing || tooOld) {
          await this.notificationModel.updateOne(
            { _id: n._id },
            { $set: { 'push.receiptsChecked': true } },
          );
        }
        checked++;
      } catch (e) {
        this.logger.warn(`Expo receipt check failed: ${(e as Error).message}`);
      }
    }
    return { checked, deactivated };
  }
}
