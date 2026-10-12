import { ownShare } from './people';
import {
  addMonths,
  calendarWeeks,
  daysInMonth,
  monthBounds,
  monthOf,
  weeksOfMonth,
  yearBounds,
} from './dates';
import type { DateRange, Transaction } from './types';

export type Totals = { income: number; expense: number; net: number };

export const inRange = (transaction: Transaction, range: DateRange) =>
  transaction.date >= range.start && transaction.date <= range.end;

/** Whether a transaction belongs in a list filtered to `accountId` (null = all). */
export function touchesAccount(
  transaction: Transaction,
  accountId: string | null | undefined,
): boolean {
  return !accountId || transaction.accountId === accountId || transaction.toAccountId === accountId;
}

/**
 * Income and expense for a period. Transfers are movements between your own
 * accounts, so they are excluded — except their fee, which is a real cost.
 */
export function periodTotals(
  transactions: Transaction[],
  range: DateRange,
  accountId?: string | null,
): Totals {
  let income = 0;
  let expense = 0;
  for (const transaction of transactions) {
    if (!inRange(transaction, range)) continue;
    const own = !accountId || transaction.accountId === accountId;
    if (!own) continue;
    if (transaction.kind === 'income') income += ownShare(transaction);
    else if (transaction.kind === 'expense') expense += ownShare(transaction);
    else expense += transaction.fee;
  }
  return { income, expense, net: income - expense };
}

export type DayGroup = Totals & { date: string; items: Transaction[] };

/** Transactions grouped by day, newest day first; items newest first. */
export function groupByDay(
  transactions: Transaction[],
  range: DateRange,
  accountId?: string | null,
): DayGroup[] {
  const days = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (!inRange(transaction, range) || !touchesAccount(transaction, accountId)) continue;
    days.set(transaction.date, [...(days.get(transaction.date) ?? []), transaction]);
  }
  return [...days.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt - a.createdAt),
      ...periodTotals(items, { start: date, end: date }, accountId),
    }));
}

export type CalendarDay = Totals & { date: string; inMonth: boolean; count: number };

/** Monday-first weeks for a month with per-day totals. */
export function calendarMonth(
  month: string,
  transactions: Transaction[],
  accountId?: string | null,
): CalendarDay[][] {
  const weeks = calendarWeeks(month);
  const range = { start: weeks[0][0], end: weeks[weeks.length - 1][6] };
  const groups = new Map(
    groupByDay(transactions, range, accountId).map((group) => [group.date, group]),
  );
  return weeks.map((week) =>
    week.map((date) => {
      const group = groups.get(date);
      return {
        date,
        inMonth: monthOf(date) === month,
        income: group?.income ?? 0,
        expense: group?.expense ?? 0,
        net: group?.net ?? 0,
        count: group?.items.length ?? 0,
      };
    }),
  );
}

export type MonthSummary = Totals & { month: string };

function monthSummary(
  month: string,
  transactions: Transaction[],
  accountId?: string | null,
): MonthSummary {
  return { month, ...periodTotals(transactions, monthBounds(month), accountId) };
}

/** Twelve months of the given year. */
export function yearSummary(
  year: number,
  transactions: Transaction[],
  accountId?: string | null,
): MonthSummary[] {
  return Array.from({ length: 12 }, (_, index) =>
    monthSummary(`${year}-${String(index + 1).padStart(2, '0')}`, transactions, accountId),
  );
}

/** The `count` months ending with `endMonth`, oldest first. */
export function monthlySeries(
  endMonth: string,
  count: number,
  transactions: Transaction[],
  accountId?: string | null,
) {
  return Array.from({ length: count }, (_, index) =>
    monthSummary(addMonths(endMonth, index - count + 1), transactions, accountId),
  );
}

export type WeekSummary = Totals & DateRange;

export function weekSummaries(
  month: string,
  transactions: Transaction[],
  accountId?: string | null,
): WeekSummary[] {
  return weeksOfMonth(month).map((range) => ({
    ...range,
    ...periodTotals(transactions, range, accountId),
  }));
}

export function yearTotals(
  year: number,
  transactions: Transaction[],
  accountId?: string | null,
): Totals {
  return periodTotals(transactions, yearBounds(year), accountId);
}

/** Percentage change; null when there is no meaningful base. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * What a month is compared with. While the month is in progress that is the
 * same days of the previous month (1–7 Oct vs 1–7 Sep), so a half-finished month
 * is never measured against a complete one; otherwise the whole previous month.
 */
export function comparisonRange(month: string, today: string): DateRange {
  const previous = addMonths(month, -1);
  const bounds = monthBounds(previous);
  if (monthOf(today) !== month) return bounds;
  const day = Math.min(Number(today.slice(8, 10)), daysInMonth(previous));
  return { start: bounds.start, end: `${previous}-${String(day).padStart(2, '0')}` };
}
