import {
  lastCompletedPeriod,
  nextPeriodBoundaries,
  periodKeyFor,
} from './billing-schedule';

const ist = (s: string) => new Date(`${s}+05:30`);
const iso = (d: Date) => d.toISOString();

describe('lastCompletedPeriod', () => {
  it('weekly: mid-week bills the previous Monday-Sunday, never the current week', () => {
    const p = lastCompletedPeriod('WEEKLY', ist('2026-10-07T12:00:00'))!;
    expect(iso(p.start)).toBe(iso(ist('2026-09-28T00:00:00')));
    expect(iso(p.end)).toBe(iso(ist('2026-10-04T23:59:59.999')));
    expect(p.key).toBe('WEEKLY:2026-09-28');
  });

  it('weekly: Sunday 23:59 IST is still inside the current week (nothing new due yet)', () => {
    const p = lastCompletedPeriod('WEEKLY', ist('2026-10-11T23:59:59'))!;
    expect(p.key).toBe('WEEKLY:2026-09-28');
  });

  it('weekly: the instant Monday 00:00 IST begins, the finished week becomes due', () => {
    const p = lastCompletedPeriod('WEEKLY', ist('2026-10-12T00:00:00'))!;
    expect(p.key).toBe('WEEKLY:2026-10-05');
  });

  it('uses IST, not UTC, for the boundary (Sun 20:00 UTC is already Mon in IST)', () => {
    // 2026-10-11T20:00Z == 2026-10-12 01:30 IST
    const p = lastCompletedPeriod('WEEKLY', new Date('2026-10-11T20:00:00Z'))!;
    expect(p.key).toBe('WEEKLY:2026-10-05');
  });

  it('monthly: mid-month bills the previous calendar month', () => {
    const p = lastCompletedPeriod('MONTHLY', ist('2026-10-15T10:00:00'))!;
    expect(p.key).toBe('MONTHLY:2026-09');
    expect(iso(p.end)).toBe(iso(ist('2026-09-30T23:59:59.999')));
  });

  it('monthly: January rolls back into December of the previous year', () => {
    const p = lastCompletedPeriod('MONTHLY', ist('2027-01-03T10:00:00'))!;
    expect(p.key).toBe('MONTHLY:2026-12');
    expect(iso(p.start)).toBe(iso(ist('2026-12-01T00:00:00')));
  });

  it('monthly: handles leap and non-leap February', () => {
    const leap = lastCompletedPeriod('MONTHLY', ist('2028-03-02T10:00:00'))!;
    expect(iso(leap.end)).toBe(iso(ist('2028-02-29T23:59:59.999')));
    const plain = lastCompletedPeriod('MONTHLY', ist('2027-03-02T10:00:00'))!;
    expect(iso(plain.end)).toBe(iso(ist('2027-02-28T23:59:59.999')));
  });

  it('pay-per-meal has no schedule', () => {
    expect(lastCompletedPeriod('PAY_PER_MEAL', new Date())).toBeNull();
  });

  it('is stable: the same instant always yields the same key (idempotent retries)', () => {
    const now = ist('2026-10-13T01:00:00');
    expect(lastCompletedPeriod('WEEKLY', now)!.key).toBe(
      lastCompletedPeriod('WEEKLY', new Date(now.getTime() + 3600_000))!.key,
    );
  });
});

describe('periodKeyFor / nextPeriodBoundaries', () => {
  it('formats keys from the IST period start', () => {
    expect(periodKeyFor('WEEKLY', ist('2026-10-05T00:00:00'))).toBe(
      'WEEKLY:2026-10-05',
    );
    expect(periodKeyFor('MONTHLY', ist('2026-10-01T00:00:00'))).toBe(
      'MONTHLY:2026-10',
    );
  });

  it('reports when the current week and month close', () => {
    const b = nextPeriodBoundaries(ist('2026-10-07T12:00:00'));
    expect(new Date(b.weekly).toISOString()).toBe(
      iso(ist('2026-10-12T00:00:00')),
    );
    expect(new Date(b.monthly).toISOString()).toBe(
      iso(ist('2026-11-01T00:00:00')),
    );
  });
});
