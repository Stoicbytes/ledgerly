import { isValidIsoDate } from '@/lib/domain/expenses';
import type { Confidence } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_WORD =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
/** "September 2026", "Sep-2026", "September, 2026", "Sep'26", "Sep-26". */
const NAMED = new RegExp(
  `\\b${MONTH_WORD}\\b(?:[\\s,.\\-/]*(\\d{4})\\b|\\s*['’\\-/](\\d{2})\\b)`,
  'i',
);
/** "01/09/2026", "1-9-2026", "2026-09-30". */
const DMY = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g;
const YMD = /\b(\d{4})-(\d{2})(?:-(\d{2}))?\b/;
const MY = /\b(\d{1,2})[/.-](\d{4})\b/;

/** Lines that name the pay month. */
const MONTH_LINE =
  /pay\s*slip|salary\s*slip|wage\s*slip|pay\s*period|salary\s*for|month\s*of|pay\s*month|salary\s*month|pay\s*statement|for\s*the\s*month|\bperiod\b|\bmonth\b/i;
/** Dates that are not the pay month: joining, birth, print date, the pay date itself. */
const OTHER_DATE =
  /join|doj|birth|dob|generated|printed|leaving|resign|effective|pay\s*date|paid\s*on|payment\s*date|credited|date\s*of/i;
const PAY_DATE =
  /pay\s*date|paid\s*on|payment\s*date|date\s*of\s*payment|credited\s*on|credit\s*date|disbursed|salary\s*credited/i;

const monthNumber = (word: string) => MONTHS.indexOf(word.slice(0, 3).toLowerCase()) + 1;
const yearOk = (year: number) => year >= 2000 && year <= 2099;
const pad = (value: number) => String(value).padStart(2, '0');

function monthIn(text: string): string | null {
  const named = NAMED.exec(text);
  if (named) {
    const year = named[2] ? Number(named[2]) : 2000 + Number(named[3]);
    if (yearOk(year)) return `${year}-${pad(monthNumber(named[1]))}`;
  }
  // A period "01/09/2026 - 30/09/2026" is the month of its last date.
  const dates = [...text.matchAll(DMY)].filter((m) => Number(m[2]) >= 1 && Number(m[2]) <= 12);
  const last = dates[dates.length - 1];
  if (last && yearOk(Number(last[3]))) return `${last[3]}-${pad(Number(last[2]))}`;
  const iso = YMD.exec(text);
  if (iso && yearOk(Number(iso[1])) && Number(iso[2]) >= 1 && Number(iso[2]) <= 12)
    return `${iso[1]}-${iso[2]}`;
  const my = MY.exec(text);
  if (my && Number(my[1]) >= 1 && Number(my[1]) <= 12 && yearOk(Number(my[2])))
    return `${my[2]}-${pad(Number(my[1]))}`;
  return null;
}

/**
 * The pay month ("2026-09"): from a line that names it (high confidence), else the first
 * month-and-year anywhere that is not a joining, birth or payment date (low).
 */
export function detectMonth(lines: string[]): { month: string; confidence: Confidence } | null {
  for (const line of lines) {
    if (MONTH_LINE.test(line) && !OTHER_DATE.test(line)) {
      const month = monthIn(line);
      if (month) return { month, confidence: 'high' };
    }
  }
  for (const line of lines) {
    if (OTHER_DATE.test(line)) continue;
    const month = monthIn(line);
    if (month) return { month, confidence: 'low' };
  }
  return null;
}

/** A date in a line as ISO: "30/09/2026", "30-Sep-2026", "30 Sep 2026", "Sep 30, 2026", "2026-09-30". */
export function dateIn(text: string): string | null {
  const candidates: [number, number, number][] = [];
  for (const m of text.matchAll(DMY)) candidates.push([Number(m[3]), Number(m[2]), Number(m[1])]);
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) candidates.push([Number(iso[1]), Number(iso[2]), Number(iso[3])]);
  const dayFirst = new RegExp(
    `\\b(\\d{1,2})[\\s\\-/]*${MONTH_WORD}[\\s,\\-/]*(\\d{4})\\b`,
    'i',
  ).exec(text);
  if (dayFirst)
    candidates.push([Number(dayFirst[3]), monthNumber(dayFirst[2]), Number(dayFirst[1])]);
  const monthFirst = new RegExp(`\\b${MONTH_WORD}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'i').exec(text);
  if (monthFirst)
    candidates.push([Number(monthFirst[3]), monthNumber(monthFirst[1]), Number(monthFirst[2])]);
  for (const [year, month, day] of candidates) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    if (yearOk(year) && isValidIsoDate(date)) return date;
  }
  return null;
}

/** The day the salary was paid, from a "Pay date" / "Paid on" / "credited on" line. */
export function detectPaidOn(lines: string[]): string | null {
  for (const line of lines) {
    if (!PAY_DATE.test(line)) continue;
    const date = dateIn(line);
    if (date) return date;
  }
  return null;
}
