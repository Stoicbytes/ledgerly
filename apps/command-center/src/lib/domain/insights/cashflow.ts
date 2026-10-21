import { addMonths, ownShare, type Transaction } from '../expenses';

export type MonthTotals = { month: string; income: number; expense: number; net: number };

/**
 * Income and spending for the `count` months ending with `endMonth`, oldest first, in one
 * pass over the entries (the same rules as periodTotals: your own share of split entries,
 * transfers left out except their fee).
 */
export function monthTotals(
  transactions: readonly Transaction[],
  endMonth: string,
  count: number,
): MonthTotals[] {
  const list = Array.from({ length: count }, (_, index) => ({
    month: addMonths(endMonth, index - count + 1),
    income: 0,
    expense: 0,
    net: 0,
  }));
  const byMonth = new Map(list.map((item) => [item.month, item]));
  for (const transaction of transactions) {
    const item = byMonth.get(transaction.date.slice(0, 7));
    if (!item) continue;
    if (transaction.kind === 'income') item.income += ownShare(transaction);
    else if (transaction.kind === 'expense') item.expense += ownShare(transaction);
    else item.expense += transaction.fee;
  }
  for (const item of list) item.net = item.income - item.expense;
  return list;
}

/**
 * The share of income kept over several months together (percent), counting only months
 * with income; null when none had any.
 */
export function averageSavingsRate(months: readonly MonthTotals[]): number | null {
  const earning = months.filter((item) => item.income > 0);
  const income = earning.reduce((sum, item) => sum + item.income, 0);
  if (!income) return null;
  return (earning.reduce((sum, item) => sum + item.net, 0) / income) * 100;
}
