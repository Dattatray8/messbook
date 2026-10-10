import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessDocument = HydratedDocument<Mess>;
export type CustomerDocument = HydratedDocument<Customer>;
export type MenuItemDocument = HydratedDocument<MenuItem>;
export type MealRecordDocument = HydratedDocument<MealRecord>;
export type BillDocument = HydratedDocument<Bill>;

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

  @Prop({ default: 0, min: 0 })
  planAmount: number;

  @Prop({ type: String, default: null })
  billingCycle?: string;
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
}

export const MessSchema = SchemaFactory.createForClass(Mess);
export const CustomerSchema = SchemaFactory.createForClass(Customer);
export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);
export const MealRecordSchema = SchemaFactory.createForClass(MealRecord);
export const BillSchema = SchemaFactory.createForClass(Bill);
