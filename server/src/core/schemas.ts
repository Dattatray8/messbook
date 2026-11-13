import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessDocument = HydratedDocument<Mess>;
export type CustomerDocument = HydratedDocument<Customer>;
export type MenuItemDocument = HydratedDocument<MenuItem>;
export type MealRecordDocument = HydratedDocument<MealRecord>;
export type BillDocument = HydratedDocument<Bill>;
export type NotificationDocument = HydratedDocument<Notification>;
export type PushTokenDocument = HydratedDocument<PushToken>;
export type AutomationSettingsDocument = HydratedDocument<AutomationSettings>;
export type AutomationRunDocument = HydratedDocument<AutomationRun>;

@Schema({ timestamps: true })
export class Mess {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ trim: true, default: null })
  phone?: string;

  @Prop({ default: null })
  logo?: string;

  @Prop({
    type: [String],
    enum: ['BREAKFAST', 'LUNCH', 'DINNER'],
    default: ['BREAKFAST', 'LUNCH', 'DINNER'],
  })
  mealTypes: Array<'BREAKFAST' | 'LUNCH' | 'DINNER'>;
}

@Schema({ timestamps: true })
export class Customer {
  @Prop({ required: true, index: true })
  messId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    required: true,
    enum: ['PAY_PER_MEAL', 'WEEKLY', 'MONTHLY'],
    default: 'PAY_PER_MEAL',
  })
  billingType: 'PAY_PER_MEAL' | 'WEEKLY' | 'MONTHLY';

  @Prop({ type: String, default: null })
  billingCycle?: string;

  /** Added by `timestamps: true`; declared so services can read it with types. */
  createdAt?: Date;
}

@Schema({ timestamps: true })
export class MenuItem {
  @Prop({ required: true, index: true })
  messId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'EXTRA'] })
  category: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'EXTRA';

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 'plate' })
  unit: string;
}

@Schema({ timestamps: true })
export class MealRecord {
  @Prop({ required: true, index: true })
  messId: string;

  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true, enum: ['BREAKFAST', 'LUNCH', 'DINNER'] })
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER';

  @Prop({ required: true, trim: true })
  mealName: string;

  @Prop({ required: true, min: 1 })
  mealQuantity: number;

  @Prop({ required: true, min: 0 })
  mealUnitPrice: number;

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ required: true, type: Date, index: true })
  mealDate: Date;

  /** Snapshot of the menu item category (EXTRA items are charged on top of weekly/monthly plans). */
  @Prop({
    type: String,
    enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'EXTRA'],
    default: null,
  })
  category?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'EXTRA';

  @Prop({ type: String, default: null })
  menuItemId?: string;

  /** Set once the record has been included in a bill, so it can never be charged twice. */
  @Prop({ type: String, default: null, index: true })
  billId?: string | null;
}

@Schema({ timestamps: true })
export class BillItem {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ required: true, min: 0 })
  amount: number;
}

@Schema({ timestamps: true })
export class Bill {
  @Prop({ required: true, index: true })
  messId: string;

  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ type: [Object], default: [] })
  items: BillItem[];

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ required: true, type: Date })
  periodStart: Date;

  @Prop({ required: true, type: Date })
  periodEnd: Date;

  @Prop({ required: true, enum: ['Generated', 'PAID'], default: 'Generated' })
  status: 'Generated' | 'PAID';

  @Prop({ trim: true, default: '' })
  customerName: string;

  @Prop({
    enum: ['PAY_PER_MEAL', 'WEEKLY', 'MONTHLY'],
    default: 'PAY_PER_MEAL',
  })
  billingType: 'PAY_PER_MEAL' | 'WEEKLY' | 'MONTHLY';

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;

  /**
   * Stable period identifier, e.g. `WEEKLY:2026-10-05` or `MONTHLY:2026-09` (IST period start).
   * Together with messId + customerId it is covered by a unique partial index, so a plan period can
   * be billed at most once even under concurrent/retried requests. Legacy bills have no periodKey.
   */
  @Prop({ type: String, default: null })
  periodKey?: string | null;

  @Prop({ enum: ['MANUAL', 'AUTOMATIC'], default: 'MANUAL' })
  source?: 'MANUAL' | 'AUTOMATIC';

  @Prop({ type: String, default: null })
  automationRunId?: string | null;
}

export type NotificationType =
  'AUTO_BILLS_GENERATED' | 'AUTOMATION_ERROR' | 'MANUAL_BILLS_GENERATED';
export type NotificationCategory = 'billing' | 'system';

@Schema({ _id: false })
export class PushDelivery {
  @Prop({
    enum: ['NOT_ATTEMPTED', 'SKIPPED', 'SENT', 'FAILED'],
    default: 'NOT_ATTEMPTED',
  })
  status: 'NOT_ATTEMPTED' | 'SKIPPED' | 'SENT' | 'FAILED';

  @Prop({ type: String, default: null })
  reason?: string | null;

  @Prop({ type: Date, default: null })
  attemptedAt?: Date | null;

  /** Expo ticket ids awaiting receipt validation: [{ ticketId, tokenId }]. */
  @Prop({ type: [Object], default: [] })
  tickets: Array<{ ticketId: string; tokenId: string; checkedAt?: Date }>;

  @Prop({ type: Boolean, default: false })
  receiptsChecked: boolean;
}
export const PushDeliverySchema = SchemaFactory.createForClass(PushDelivery);

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true })
  messId: string;

  @Prop({
    required: true,
    enum: [
      'AUTO_BILLS_GENERATED',
      'AUTOMATION_ERROR',
      'MANUAL_BILLS_GENERATED',
    ],
  })
  type: NotificationType;

  @Prop({ required: true, enum: ['billing', 'system'] })
  category: NotificationCategory;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date, default: null })
  readAt?: Date | null;

  /** What the notification points at: a single bill, the bills list, or the automation screen. */
  @Prop({
    type: String,
    enum: ['bill', 'bills', 'automation', null],
    default: null,
  })
  relatedType?: 'bill' | 'bills' | 'automation' | null;

  @Prop({ type: String, default: null })
  relatedId?: string | null;

  /** Stable idempotency key. Unique per owner so retried scheduled work cannot duplicate it. */
  @Prop({ type: String, default: null })
  eventKey?: string | null;

  /** Non-sensitive navigation/summary data only (counts, ids). Never customer names or phones. */
  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  @Prop({ type: PushDeliverySchema, default: () => ({}) })
  push: PushDelivery;
}

@Schema({ timestamps: true })
export class PushToken {
  @Prop({ required: true, index: true })
  ownerId: string;

  /** Opaque, app-generated id for the installation (not a hardware identifier). */
  @Prop({ required: true })
  deviceId: string;

  /** Expo push token. Treated as a delivery address only, never as authentication. */
  @Prop({ required: true })
  token: string;

  @Prop({ enum: ['ios', 'android', 'web', 'unknown'], default: 'unknown' })
  platform: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastSeenAt?: Date | null;

  @Prop({ type: Date, default: null })
  deactivatedAt?: Date | null;

  @Prop({ type: String, default: null })
  deactivatedReason?: string | null;
}

@Schema({ _id: false })
export class LastRunSummary {
  @Prop({ type: String, default: null }) runId?: string | null;
  @Prop({ type: String, default: null }) status?: string | null;
  @Prop({ type: Date, default: null }) finishedAt?: Date | null;
  @Prop({ type: Number, default: 0 }) created: number;
  @Prop({ type: Number, default: 0 }) skipped: number;
  @Prop({ type: Number, default: 0 }) failed: number;
  @Prop({ type: String, default: null }) errorSummary?: string | null;
}
export const LastRunSummarySchema =
  SchemaFactory.createForClass(LastRunSummary);

@Schema({ timestamps: true })
export class AutomationSettings {
  @Prop({ required: true, unique: true })
  ownerId: string;

  @Prop({ required: true, unique: true })
  messId: string;

  /** Controls SCHEDULED generation only. Manual generation never reads this. */
  @Prop({ default: false })
  enabled: boolean;

  @Prop({ default: 'Asia/Kolkata' })
  timezone: string;

  /** App-level notification preferences, stored separately from OS permission. */
  @Prop({ default: false })
  pushEnabled: boolean;

  @Prop({ default: true })
  billingNotifications: boolean;

  /** Run lease: prevents two overlapping runs for the same mess (scheduled or manual). */
  @Prop({ type: Date, default: null })
  lockedUntil?: Date | null;

  @Prop({ type: String, default: null })
  lockedBy?: string | null;

  /** Last successful SCHEDULED run (for "last run" / awaiting-scheduler display). */
  @Prop({ type: Date, default: null })
  lastScheduledRunAt?: Date | null;

  @Prop({ type: LastRunSummarySchema, default: null })
  lastRun?: LastRunSummary | null;
}

@Schema({ _id: false })
export class RunFailure {
  @Prop() customerId: string;
  @Prop() periodKey: string;
  /** Short, non-sensitive reason. Never a stack trace. */
  @Prop() reason: string;
}
export const RunFailureSchema = SchemaFactory.createForClass(RunFailure);

@Schema({ timestamps: true })
export class AutomationRun {
  @Prop({ required: true, unique: true })
  runId: string;

  @Prop({ required: true, index: true })
  messId: string;

  @Prop({ required: true, enum: ['SCHEDULED', 'MANUAL'] })
  trigger: 'SCHEDULED' | 'MANUAL';

  @Prop({
    required: true,
    enum: ['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED'],
  })
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  finishedAt?: Date | null;

  @Prop({ default: 0 }) processedCustomers: number;
  @Prop({ default: 0 }) created: number;
  @Prop({ default: 0 }) skippedAlreadyBilled: number;
  @Prop({ default: 0 }) skippedNothingToBill: number;
  @Prop({ default: 0 }) failed: number;

  @Prop({ type: String, default: null })
  errorSummary?: string | null;

  /** Capped list of per-customer failures (ids only). */
  @Prop({ type: [RunFailureSchema], default: [] })
  failures: RunFailure[];

  @Prop({ type: [String], default: [] })
  billIds: string[];
}

export const MessSchema = SchemaFactory.createForClass(Mess);
export const CustomerSchema = SchemaFactory.createForClass(Customer);
export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);
export const MealRecordSchema = SchemaFactory.createForClass(MealRecord);
export const BillSchema = SchemaFactory.createForClass(Bill);
export const NotificationSchema = SchemaFactory.createForClass(Notification);
export const PushTokenSchema = SchemaFactory.createForClass(PushToken);
export const AutomationSettingsSchema =
  SchemaFactory.createForClass(AutomationSettings);
export const AutomationRunSchema = SchemaFactory.createForClass(AutomationRun);

// ---- Indexes -------------------------------------------------------------------------------
// A plan period can be billed once per customer. Partial so legacy bills (no periodKey) and
// pay-per-meal bills (periodKey null) are unaffected and the index builds on existing data.
BillSchema.index(
  { messId: 1, customerId: 1, periodKey: 1 },
  {
    unique: true,
    partialFilterExpression: { periodKey: { $type: 'string' } },
  },
);
BillSchema.index({ messId: 1, createdAt: -1 });

NotificationSchema.index({ ownerId: 1, createdAt: -1 });
NotificationSchema.index({ ownerId: 1, isRead: 1 });
NotificationSchema.index(
  { ownerId: 1, eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: 'string' } } },
);
// Notifications are pruned after a year; bills are never touched by this.
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 },
);

PushTokenSchema.index({ token: 1 }, { unique: true });
PushTokenSchema.index({ ownerId: 1, deviceId: 1 }, { unique: true });

AutomationRunSchema.index({ messId: 1, startedAt: -1 });
AutomationRunSchema.index(
  { startedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 },
);
