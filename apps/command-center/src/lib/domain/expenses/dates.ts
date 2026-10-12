/** Calendar-date helpers. Dates are local, zone-free strings: YYYY-MM-DD / YYYY-MM. */

const pad = (value: number) => String(value).padStart(2, '0');

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses at local noon so DST shifts never change the calendar day. */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toIsoDate(parseIsoDate(value)) === value;
}

export const todayIso = (now = new Date()) => toIsoDate(now);
export const monthOf = (iso: string) => iso.slice(0, 7);
export const yearOfMonth = (month: string) => Number(month.slice(0, 4));

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function addMonths(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + delta, 1, 12);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index, 0).getDate();
}

export function monthBounds(month: string) {
  return { start: `${month}-01`, end: `${month}-${pad(daysInMonth(month))}` };
}

export function yearBounds(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(iso: string): number {
  return (parseIsoDate(iso).getDay() + 6) % 7;
}

/** Whole weeks (Monday-first) covering the month: 4–6 rows of 7 dates. */
export function calendarWeeks(month: string): string[][] {
  const { start, end } = monthBounds(month);
  let cursor = addDays(start, -weekdayIndex(start));
  const weeks: string[][] = [];
  while (cursor <= end) {
    const week = Array.from({ length: 7 }, (_, offset) => addDays(cursor, offset));
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** Monday–Sunday week ranges clipped to the month. */
export function weeksOfMonth(month: string) {
  const { start, end } = monthBounds(month);
  return calendarWeeks(month).map((week) => ({
    start: week[0] < start ? start : week[0],
    end: week[6] > end ? end : week[6],
  }));
}

export function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: style,
    year: style === 'long' ? 'numeric' : undefined,
  }).format(parseIsoDate(`${month}-01`));
}

export function dayLabel(iso: string, style: 'long' | 'short' = 'long'): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short' };
  return new Intl.DateTimeFormat('en-IN', options).format(parseIsoDate(iso));
}
