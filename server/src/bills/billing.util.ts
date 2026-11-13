import { BillItem } from '../core/schemas';

export type BillingType = 'PAY_PER_MEAL' | 'WEEKLY' | 'MONTHLY';

export interface BillableRecord {
  mealName: string;
  category?: string | null;
  mealQuantity: number;
  mealUnitPrice: number;
  totalAmount: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function groupRecords(records: BillableRecord[]): BillItem[] {
  const map = new Map<string, BillItem>();
  for (const r of records) {
    const key = `${r.mealName}__${r.mealUnitPrice}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += r.mealQuantity;
      existing.amount = round2(existing.amount + r.totalAmount);
    } else {
      map.set(key, {
        name: r.mealName,
        quantity: r.mealQuantity,
        unitPrice: r.mealUnitPrice,
        amount: round2(r.totalAmount),
      });
    }
  }
  return [...map.values()];
}

/**
 * All billing types charge the actual recorded meals at their snapshotted prices.
 * Billing type controls only when a bill is generated, not a fixed allowance or plan fee.
 */
export function computeBill(
  _billingType: BillingType,
  _legacyPlanAmount: number,
  records: BillableRecord[],
) {
  const items = groupRecords(records);
  const totalAmount = round2(items.reduce((sum, i) => sum + i.amount, 0));
  return { items, totalAmount, coveredCount: 0 };
}
