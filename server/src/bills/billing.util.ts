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
 * Billing rules
 * - PAY_PER_MEAL: every unbilled record in the period is charged at the price stored when it was recorded.
 * - WEEKLY / MONTHLY: the customer pays their fixed plan amount. Regular meals are covered by the plan
 *   (so they are never charged again); EXTRA-category items are charged on top.
 * Prices come from the meal records (snapshots), so later menu price changes never alter old bills.
 */
export function computeBill(
  billingType: BillingType,
  planAmount: number,
  records: BillableRecord[],
) {
  const items: BillItem[] = [];
  let coveredRecords: BillableRecord[] = [];

  if (billingType === 'PAY_PER_MEAL') {
    items.push(...groupRecords(records));
  } else {
    if (planAmount > 0) {
      items.push({
        name:
          billingType === 'WEEKLY' ? 'Weekly meal plan' : 'Monthly meal plan',
        quantity: 1,
        unitPrice: planAmount,
        amount: round2(planAmount),
      });
    }
    const extras = records.filter((r) => r.category === 'EXTRA');
    coveredRecords = records.filter((r) => r.category !== 'EXTRA');
    items.push(...groupRecords(extras));
  }

  const totalAmount = round2(items.reduce((sum, i) => sum + i.amount, 0));
  return { items, totalAmount, coveredCount: coveredRecords.length };
}
