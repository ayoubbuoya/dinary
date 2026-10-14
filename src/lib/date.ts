export function getLocalMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Parses a `YYYY-MM` key. Returns null when the key is malformed. */
export function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}

export function isValidMonthKey(value: unknown): value is string {
  return typeof value === 'string' && parseMonthKey(value) !== null;
}

/** First day of the month, in the device timezone. */
export function monthKeyToDate(monthKey: string) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) throw new Error(`Invalid month key: ${monthKey}`);
  return new Date(parsed.year, parsed.month, 1);
}

/** Moves a month key forward or backward, for example `shiftMonthKey('2026-01', -1)` is `2025-12`. */
export function shiftMonthKey(monthKey: string, delta: number) {
  const date = monthKeyToDate(monthKey);
  return getLocalMonthKey(new Date(date.getFullYear(), date.getMonth() + delta, 1));
}

/** Number of months from `from` to `to` (0 when equal, negative when `to` is earlier). */
export function monthKeyDiff(from: string, to: string) {
  const a = monthKeyToDate(from);
  const b = monthKeyToDate(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Last day of the month at 23:59:59.999 local time. */
export function endOfMonth(monthKey: string) {
  const date = monthKeyToDate(monthKey);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat('en-TN', { month: 'long', year: 'numeric' }).format(date);
}

export function formatMonthKey(monthKey: string) {
  return formatMonthYear(monthKeyToDate(monthKey));
}

/** Short month label such as "Oct". */
export function formatShortMonth(monthKey: string) {
  return new Intl.DateTimeFormat('en-TN', { month: 'short' }).format(monthKeyToDate(monthKey));
}

export function formatToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-TN', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}
