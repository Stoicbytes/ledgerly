import { addMonths, daysInMonth, ownShare, type Transaction } from '../expenses';
import { monthTotals } from './cashflow';

export type PaceDay = {
  day: number;
  /** Spent from the 1st to this day, this month. */
  spent: number;
  /** The same for last month (its last day when it is shorter). */
  last: number;
};

/** What one entry costs you: your share of an expense, a transfer's fee, nothing for income. */
const cost = (item: Transaction) =>
  item.kind === 'expense' ? ownShare(item) : item.kind === 'transfer' ? item.fee : 0;

/**
 * Spending so far this month, day by day up to today, next to last month's at the same day
 * (both added up from the 1st), for the home screen's pace chart.
 */
export function spendingPace(transactions: readonly Transaction[], today: string): PaceDay[] {
  const month = today.slice(0, 7);
  const previous = addMonths(month, -1);
  const day = Number(today.slice(8, 10));
  const now = new Array<number>(day + 1).fill(0);
  const before = new Array<number>(daysInMonth(previous) + 1).fill(0);
  for (const item of transactions) {
    const at = Number(item.date.slice(8, 10));
    if (item.date.startsWith(month) && at <= day) now[at] += cost(item);
    else if (item.date.startsWith(previous)) before[at] += cost(item);
  }
  const days: PaceDay[] = [];
  let spent = 0;
  let last = 0;
  for (let at = 1; at <= day; at += 1) {
    spent += now[at];
    if (at < before.length) last += before[at];
    days.push({ day: at, spent, last });
  }
  return days;
}

export type MonthRate = { month: string; income: number; net: number; rate: number | null };

/** The share of income kept in each of the `count` months ending with `month` (percent). */
export function savingsRates(
  transactions: readonly Transaction[],
  month: string,
  count: number,
): MonthRate[] {
  return monthTotals(transactions, month, count).map((item) => ({
    month: item.month,
    income: item.income,
    net: item.net,
    rate: item.income > 0 ? (item.net / item.income) * 100 : null,
  }));
}
