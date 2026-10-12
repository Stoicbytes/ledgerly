import { OTHER_ID, TRANSFER_FEES_ID, UNCATEGORIZED_ID, resolveCategory } from './categories';
import { addMonths, monthBounds } from './dates';
import { isRepayment, ownShare } from './people';
import { inRange } from './periods';
import type { Category, CategoryKind, DateRange, Transaction } from './types';

/** How a period's income or spending splits across categories (pies, rankings, drill-downs). */
export type Slice = {
  id: string;
  name: string;
  amount: number;
  share: number;
  count: number;
  category: Category | null;
};

function toSlices(
  totals: Map<string, { amount: number; count: number; name: string; category: Category | null }>,
): Slice[] {
  const sum = [...totals.values()].reduce((total, item) => total + item.amount, 0);
  return [...totals.entries()]
    .map(([id, item]) => ({ id, ...item, share: sum ? item.amount / sum : 0 }))
    .filter((slice) => slice.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

/** Spending (or income) per top-level category; sums exactly to the period total. */
export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  kind: CategoryKind,
  range: DateRange,
  accountId?: string | null,
): Slice[] {
  const totals = new Map<
    string,
    { amount: number; count: number; name: string; category: Category | null }
  >();
  const add = (id: string, name: string, category: Category | null, amount: number) => {
    const current = totals.get(id) ?? { amount: 0, count: 0, name, category };
    totals.set(id, { ...current, amount: current.amount + amount, count: current.count + 1 });
  };
  for (const transaction of transactions) {
    if (!inRange(transaction, range) || (accountId && transaction.accountId !== accountId))
      continue;
    if (transaction.kind === kind) {
      // Repayments are not income; a split expense counts only your share.
      if (isRepayment(transaction)) continue;
      const { parent } = resolveCategory(categories, transaction.categoryId);
      const share = ownShare(transaction);
      if (parent) add(parent.id, parent.name, parent, share);
      else add(UNCATEGORIZED_ID, 'Uncategorized', null, share);
    } else if (kind === 'expense' && transaction.kind === 'transfer' && transaction.fee > 0) {
      add(TRANSFER_FEES_ID, 'Transfer fees', null, transaction.fee);
    }
  }
  return toSlices(totals);
}

/** Keeps the largest `limit - 1` slices and folds the rest into one "Other" slice. */
export function limitSlices(slices: Slice[], limit: number): Slice[] {
  if (slices.length <= limit) return slices;
  const rest = slices.slice(limit - 1);
  const other = rest.reduce(
    (sum, slice) => ({
      amount: sum.amount + slice.amount,
      share: sum.share + slice.share,
      count: sum.count + slice.count,
    }),
    { amount: 0, share: 0, count: 0 },
  );
  return [
    ...slices.slice(0, limit - 1),
    { id: OTHER_ID, name: `Other (${rest.length})`, category: null, ...other },
  ];
}

/** Breakdown of one top-level category into its subcategories (+ "General" for parent-only entries). */
export function subcategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  parentId: string,
  range: DateRange,
  accountId?: string | null,
): Slice[] {
  const parent = categories.find((category) => category.id === parentId) ?? null;
  const totals = new Map<
    string,
    { amount: number; count: number; name: string; category: Category | null }
  >();
  for (const transaction of transactionsInCategory(
    transactions,
    categories,
    parentId,
    range,
    accountId,
  )) {
    const { sub } = resolveCategory(categories, transaction.categoryId);
    const id = sub?.id ?? parentId;
    const current = totals.get(id) ?? {
      amount: 0,
      count: 0,
      name: sub?.name ?? `${parent?.name ?? ''} (general)`,
      category: sub ?? parent,
    };
    totals.set(id, {
      ...current,
      amount: current.amount + ownShare(transaction),
      count: current.count + 1,
    });
  }
  return toSlices(totals);
}

/**
 * Income/expense transactions whose leaf category belongs to `parentId`. With
 * `sliceId`, only one subcategory slice: a subcategory id, or `parentId` itself for
 * entries filed directly under the parent (the "(general)" slice).
 */
export function transactionsInCategory(
  transactions: Transaction[],
  categories: Category[],
  parentId: string,
  range: DateRange,
  accountId?: string | null,
  sliceId?: string | null,
): Transaction[] {
  return transactions
    .filter(
      (transaction) =>
        transaction.kind !== 'transfer' && !isRepayment(transaction) && inRange(transaction, range),
    )
    .filter((transaction) => !accountId || transaction.accountId === accountId)
    .filter((transaction) => {
      const { parent, sub } = resolveCategory(categories, transaction.categoryId);
      if (parent?.id !== parentId) return false;
      return !sliceId || (sub?.id ?? parentId) === sliceId;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

/** Monthly totals for one top-level category (or one of its slices), oldest first. */
export function categoryTrend(
  transactions: Transaction[],
  categories: Category[],
  parentId: string,
  endMonth: string,
  months = 6,
  accountId?: string | null,
  sliceId?: string | null,
) {
  return Array.from({ length: months }, (_, index) => {
    const month = addMonths(endMonth, index - months + 1);
    const amount = transactionsInCategory(
      transactions,
      categories,
      parentId,
      monthBounds(month),
      accountId,
      sliceId,
    ).reduce((sum, transaction) => sum + ownShare(transaction), 0);
    return { month, amount };
  });
}
