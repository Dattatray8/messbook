export const inr = (n: number | undefined | null) =>
  `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const fmtDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const fmtShort = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Local calendar day as YYYY-MM-DD (the server reads it as an IST day). */
export const toDayString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const addDaysLocal = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

export const isSameDay = (a: Date, b: Date) => toDayString(a) === toDayString(b);
