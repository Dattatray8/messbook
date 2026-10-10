import { computeBill } from './billing.util';
import { monthPeriod, startOfDayIST, weekPeriod } from '../common/dates';

const rec = (name: string, qty: number, price: number, category = 'LUNCH') => ({
  mealName: name,
  category,
  mealQuantity: qty,
  mealUnitPrice: price,
  totalAmount: qty * price,
});

describe('computeBill', () => {
  it('pay per meal groups by item and price', () => {
    const r = computeBill('PAY_PER_MEAL', 0, [
      rec('Thali', 1, 80),
      rec('Thali', 2, 80),
      rec('Tea', 1, 10, 'EXTRA'),
    ]);
    expect(r.items).toHaveLength(2);
    expect(r.totalAmount).toBe(250);
  });

  it('keeps different historical prices as separate lines', () => {
    const r = computeBill('PAY_PER_MEAL', 0, [
      rec('Thali', 1, 80),
      rec('Thali', 1, 90),
    ]);
    expect(r.items).toHaveLength(2);
    expect(r.totalAmount).toBe(170);
  });

  it('weekly plan charges plan amount only, meals are covered', () => {
    const r = computeBill('WEEKLY', 500, [
      rec('Thali', 5, 80),
      rec('Dinner', 5, 70, 'DINNER'),
    ]);
    expect(r.totalAmount).toBe(500);
    expect(r.coveredCount).toBe(2);
  });

  it('monthly plan adds EXTRA items on top', () => {
    const r = computeBill('MONTHLY', 2400, [
      rec('Thali', 30, 80),
      rec('Sweet', 2, 25, 'EXTRA'),
    ]);
    expect(r.totalAmount).toBe(2450);
    expect(r.items).toHaveLength(2);
  });
});

describe('periods (IST)', () => {
  it('week starts Monday', () => {
    // Wed 2026-10-07 12:00 IST
    const { start, end } = weekPeriod(new Date('2026-10-07T12:00:00+05:30'));
    expect(start.toISOString()).toBe(
      new Date('2026-10-05T00:00:00+05:30').toISOString(),
    );
    expect(end.toISOString()).toBe(
      new Date('2026-10-11T23:59:59.999+05:30').toISOString(),
    );
  });

  it('Sunday belongs to the week that started the previous Monday', () => {
    const { start } = weekPeriod(new Date('2026-10-11T23:00:00+05:30'));
    expect(start.toISOString()).toBe(
      new Date('2026-10-05T00:00:00+05:30').toISOString(),
    );
  });

  it('month covers the whole calendar month', () => {
    const { start, end } = monthPeriod(new Date('2026-02-15T10:00:00+05:30'));
    expect(start.toISOString()).toBe(
      new Date('2026-02-01T00:00:00+05:30').toISOString(),
    );
    expect(end.toISOString()).toBe(
      new Date('2026-02-28T23:59:59.999+05:30').toISOString(),
    );
  });

  it('startOfDayIST handles late-night IST correctly', () => {
    expect(
      startOfDayIST(new Date('2026-10-10T23:30:00+05:30')).toISOString(),
    ).toBe(new Date('2026-10-10T00:00:00+05:30').toISOString());
  });
});
