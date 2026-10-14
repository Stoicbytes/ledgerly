import { addMonths, daysInMonth, monthBounds, monthOf } from './dates';
import { periodTotals } from './periods';
import type { DateRange, Transaction } from './types';

export type MonthProjection = {
  /** Spent from the 1st to today. */
  spent: number;
  /** What the rest of a month usually costs: the median of the last three months. */
  rest: number;
  /** About what the month will come to: spent + rest. */
  projected: number;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

/**
 * About what this month's spending will come to: what is spent so far, plus what the same
 * days (from tomorrow to the month's end) usually cost, the median of the last three months
 * that have entries. A big cost early in the month (rent on the 1st) is not multiplied over
 * the month, and a one-off in an earlier month does not move the median much. Null without
 * an earlier month to go by. `spentIn` gives the spending in a range (all spending by
 * default; a category's for a budget).
 */
export function projectMonthEnd(
  transactions: Transaction[],
  today: string,
  spentIn: (range: DateRange) => number = (range) => periodTotals(transactions, range).expense,
): MonthProjection | null {
  const month = monthOf(today);
  const day = Number(today.slice(8, 10));
  const tracked = new Set(transactions.map((item) => monthOf(item.date)));
  const history = [1, 2, 3].map((back) => addMonths(month, -back)).filter((m) => tracked.has(m));
  if (!history.length) return null;
  const spent = spentIn({ start: monthBounds(month).start, end: today });
  const rest =
    day >= daysInMonth(month)
      ? 0
      : median(
          history.map((m) =>
            day >= daysInMonth(m)
              ? 0
              : spentIn({
                  start: `${m}-${String(day + 1).padStart(2, '0')}`,
                  end: monthBounds(m).end,
                }),
          ),
        );
  return { spent, rest, projected: spent + rest };
}
