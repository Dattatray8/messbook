import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { InternalJobsController } from '../automation/internal-jobs.controller';
import { JobSecretGuard } from '../automation/job-secret.guard';
import { AutomationController } from '../automation/automation.controller';
import { NotificationsController } from '../notifications/notifications.controller';
import { BillsController } from '../bills/bills.controller';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import {
  AutomationRunSchema,
  BillSchema,
  NotificationSchema,
  PushTokenSchema,
} from './schemas';

const idx = (schema: any) =>
  schema.indexes as Array<{ fields: any; options: any }>;
const find = (schema: any, fields: Record<string, number>) =>
  idx(schema).find((i) => JSON.stringify(i.fields) === JSON.stringify(fields));

// NOTE: these verify the index DEFINITIONS. They cannot prove database-level behaviour; that needs a
// real MongoDB (see the deployment doc's index-verification step).
describe('declared indexes', () => {
  it('bills: unique partial (messId, customerId, periodKey) so only string periodKeys are constrained', () => {
    const i = find(BillSchema, { messId: 1, customerId: 1, periodKey: 1 })!;
    expect(i.options.unique).toBe(true);
    expect(i.options.partialFilterExpression).toEqual({
      periodKey: { $type: 'string' },
    });
  });
  it('notifications: unique per (ownerId, eventKey), only when an eventKey exists', () => {
    const i = find(NotificationSchema, { ownerId: 1, eventKey: 1 })!;
    expect(i.options.unique).toBe(true);
    expect(i.options.partialFilterExpression).toEqual({
      eventKey: { $type: 'string' },
    });
  });
  it('push tokens: a token is globally unique; one token per (owner, device)', () => {
    expect(find(PushTokenSchema, { token: 1 })!.options.unique).toBe(true);
    expect(
      find(PushTokenSchema, { ownerId: 1, deviceId: 1 })!.options.unique,
    ).toBe(true);
  });
  it('automation run history expires after 90 days; bills are never given a TTL', () => {
    expect(
      find(AutomationRunSchema, { startedAt: 1 })!.options.expireAfterSeconds,
    ).toBe(90 * 86400);
    expect(idx(BillSchema).some((i) => 'expireAfterSeconds' in i.options)).toBe(
      false,
    );
  });
});

describe('endpoint protection', () => {
  it('the internal job controller bypasses the session guard but requires the job secret', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, InternalJobsController)).toBe(
      true,
    );
    expect(Reflect.getMetadata('__guards__', InternalJobsController)).toContain(
      JobSecretGuard,
    );
    expect(Reflect.getMetadata(PATH_METADATA, InternalJobsController)).toBe(
      'internal/jobs/billing',
    );
  });
  it('owner-facing controllers are NOT public (global session AuthGuard applies)', () => {
    for (const c of [
      AutomationController,
      NotificationsController,
      BillsController,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, c)).toBeUndefined();
    }
  });
});
