/** Indian Standard Time has a fixed +05:30 offset (no DST), so day maths can be done with plain arithmetic. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDayIST(d: Date): Date {
  const shifted = d.getTime() + IST_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

export function endOfDayIST(d: Date): Date {
  return new Date(startOfDayIST(d).getTime() + DAY_MS - 1);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Parses 'YYYY-MM-DD' (interpreted as an IST calendar day) or a full ISO string. */
export function parseDay(input: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T00:00:00+05:30`);
  }
  return new Date(input);
}

/** Weekly period: Monday 00:00 IST through Sunday 23:59:59.999 IST. */
export function weekPeriod(ref: Date) {
  const day = startOfDayIST(ref);
  const dow = new Date(day.getTime() + IST_OFFSET_MS).getUTCDay(); // 0 = Sunday
  const start = addDays(day, -((dow + 6) % 7));
  return { start, end: new Date(addDays(start, 7).getTime() - 1) };
}

/** Monthly period: first of the month 00:00 IST through the last instant of the month. */
export function monthPeriod(ref: Date) {
  const shifted = new Date(ref.getTime() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS);
  const nextStart = new Date(Date.UTC(y, m + 1, 1) - IST_OFFSET_MS);
  return { start, end: new Date(nextStart.getTime() - 1) };
}
