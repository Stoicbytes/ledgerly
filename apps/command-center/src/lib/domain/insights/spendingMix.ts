import {
  OTHER_ID,
  categoryBreakdown,
  comparisonRange,
  limitSlices,
  monthBounds,
  monthOf,
  type Category,
  type Slice,
  type Transaction,
} from '../expenses';

export type SpendingRow = Slice & {
  /** Spent in the same days of last month (what `comparisonRange` compares with). */
  previous: number;
};

/**
 * This month's spending by category: the five largest and the rest as "Other", each with
 * what it was over the same days of last month, and the totals.
 */
export function spendingMix(
  transactions: Transaction[],
  categories: Category[],
  today: string,
  limit = 6,
) {
  const month = monthOf(today);
  const now = categoryBreakdown(transactions, categories, 'expense', monthBounds(month));
  const before = categoryBreakdown(
    transactions,
    categories,
    'expense',
    comparisonRange(month, today),
  );
  const earlier = new Map(before.map((slice) => [slice.id, slice.amount]));
  const shown = limitSlices(now, limit);
  const named = new Set(shown.map((slice) => slice.id));
  const rows: SpendingRow[] = shown.map((slice) => ({
    ...slice,
    previous:
      slice.id === OTHER_ID
        ? before.filter((item) => !named.has(item.id)).reduce((sum, item) => sum + item.amount, 0)
        : (earlier.get(slice.id) ?? 0),
  }));
  return {
    rows,
    total: now.reduce((sum, slice) => sum + slice.amount, 0),
    previousTotal: before.reduce((sum, slice) => sum + slice.amount, 0),
  };
}
