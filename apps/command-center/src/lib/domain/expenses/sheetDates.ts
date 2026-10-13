/**
 * Dates in exported sheets: an Excel serial (days since 1899-12-30, the fraction is the
 * time of day) or text such as "2026-08-14 10:49", "14/08/2026" or "8/14/2026 7:05 PM".
 * Whether a text date is day-first or month-first is decided once per file: a first part
 * above 12 means day-first, a second part above 12 means month-first, and day-first
 * (as in India) when nothing tells them apart.
 */
type Cell = string | number | boolean | null;

export type When = { date: string; at: number };

const DAY = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
/** The range the database accepts for an entry's date. */
const FIRST = '1900-01-01';
const LAST = '2100-12-31';

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
const NUMERIC = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/;
const TIME = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i;

const text = (cell: Cell | undefined) =>
  cell === null || cell === undefined ? '' : String(cell).trim();

function build(year: number, month: number, day: number, value: string): When | null {
  const base = Date.UTC(year, month - 1, day);
  const parsed = new Date(base);
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  const date = parsed.toISOString().slice(0, 10);
  if (date < FIRST || date > LAST) return null;
  const time = TIME.exec(value.replace(/^[^\sT]+/, ''));
  let hours = time ? Number(time[1]) % 24 : 0;
  if (time?.[4]) hours = (hours % 12) + (/p/i.test(time[4]) ? 12 : 0);
  const minutes = time ? Number(time[2]) % 60 : 0;
  return { date, at: base + (hours * 60 + minutes) * 60_000 + Number(time?.[3] ?? 0) * 1000 };
}

/** Day-first unless the file's own dates show they are month-first. */
export function dayFirst(cells: (Cell | undefined)[]): boolean {
  let monthFirst = false;
  for (const cell of cells) {
    const match = NUMERIC.exec(text(cell));
    if (!match) continue;
    if (Number(match[1]) > 12) return true;
    if (Number(match[2]) > 12) monthFirst = true;
  }
  return !monthFirst;
}

export function readWhen(cell: Cell | undefined, isDayFirst = true): When | null {
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell) || cell < 1) return null;
    const at = EXCEL_EPOCH + Math.round(cell * DAY);
    const date = new Date(Math.floor(at / DAY) * DAY).toISOString().slice(0, 10);
    return date < FIRST || date > LAST ? null : { date, at };
  }
  const value = text(cell);
  const iso = ISO.exec(value);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]), value);
  const numeric = NUMERIC.exec(value);
  if (!numeric) return null;
  const [first, second] = [Number(numeric[1]), Number(numeric[2])];
  const year = Number(numeric[3]) + (numeric[3].length === 2 ? 2000 : 0);
  return isDayFirst ? build(year, second, first, value) : build(year, first, second, value);
}
