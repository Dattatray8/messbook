import {
  monthPeriod,
  toISTDateString,
  toISTMonthString,
  weekPeriod,
} from '../common/dates';
import { BillingType } from './billing.util';

export interface BillingPeriod {
  start: Date;
  end: Date;
  /** Stable identifier, e.g. WEEKLY:2026-10-05 or MONTHLY:2026-09. */
  key: string;
}

/** Stable identifier for the period starting at `start` (an IST period boundary). */
export function periodKeyFor(
  billingType: Exclude<BillingType, 'PAY_PER_MEAL'>,
  start: Date,
): string {
  return billingType === 'WEEKLY'
    ? `WEEKLY:${toISTDateString(start)}`
    : `MONTHLY:${toISTMonthString(start)}`;
}

/** The period containing `ref` (what the existing manual flow bills by default). */
export function periodContaining(
  billingType: Exclude<BillingType, 'PAY_PER_MEAL'>,
  ref: Date,
): BillingPeriod {
  const { start, end } =
    billingType === 'WEEKLY' ? weekPeriod(ref) : monthPeriod(ref);
  return { start, end, key: periodKeyFor(billingType, start) };
}

/**
 * The most recent COMPLETED period as of `now`. Incomplete (current) periods are never
 * auto-billed. Returns null for PAY_PER_MEAL, which has no cycle to schedule.
 *
 * Only the latest completed period is considered: a scheduler outage never causes a burst of
 * historic bills. Older missed periods can be billed with the manual flow.
 */
export function lastCompletedPeriod(
  billingType: BillingType,
  now: Date,
): BillingPeriod | null {
  if (billingType === 'PAY_PER_MEAL') return null;
  const current = periodContaining(billingType, now);
  // 1 ms before the current period begins always lies inside the previous period.
  const previous = periodContaining(
    billingType,
    new Date(current.start.getTime() - 1),
  );
  return previous;
}

/** When the next weekly / monthly period begins (i.e. when new bills first become due). */
export function nextPeriodBoundaries(now: Date) {
  const week = weekPeriod(now);
  const month = monthPeriod(now);
  return {
    weekly: week.end.getTime() + 1,
    monthly: month.end.getTime() + 1,
  };
}
