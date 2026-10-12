import { categoryPath } from './categories';
import { ownShare } from './people';
import type { Account, Category, Person, Transaction, TransactionKind } from './types';

export type SearchFilters = {
  /** Words to find in the note, category, account or person; a number finds that amount. */
  text: string;
  kind: TransactionKind | 'all';
  /** A category, with its subcategories. */
  categoryId: string | null;
  accountId: string | null;
  /** Inclusive dates (YYYY-MM-DD), or null for no limit. */
  from: string | null;
  to: string | null;
};

export const EMPTY_SEARCH: SearchFilters = {
  text: '',
  kind: 'all',
  categoryId: null,
  accountId: null,
  from: null,
  to: null,
};

export const isSearching = (filters: SearchFilters) =>
  !!filters.text.trim() ||
  filters.kind !== 'all' ||
  !!filters.categoryId ||
  !!filters.accountId ||
  !!filters.from ||
  !!filters.to;

type Context = { categories: Category[]; accounts: Account[]; people: Person[] };

/** A number typed in the search, in paise ("250", "1,250.50"), or null. */
function searchedAmount(word: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(word.replace(/[₹,]/g, ''));
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** Entries matching every filter and every word, newest first. */
export function searchTransactions(
  transactions: Transaction[],
  filters: SearchFilters,
  context: Context,
): Transaction[] {
  const words = filters.text.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const accountName = new Map(context.accounts.map((a) => [a.id, a.name]));
  const personName = new Map(context.people.map((p) => [p.id, p.name]));
  const inCategory = filters.categoryId
    ? new Set(
        context.categories
          .filter((c) => c.id === filters.categoryId || c.parentId === filters.categoryId)
          .map((c) => c.id),
      )
    : null;
  return transactions
    .filter((t) => {
      if (filters.kind !== 'all' && t.kind !== filters.kind) return false;
      if (inCategory && !(t.categoryId && inCategory.has(t.categoryId))) return false;
      if (
        filters.accountId &&
        t.accountId !== filters.accountId &&
        t.toAccountId !== filters.accountId
      )
        return false;
      if (filters.from && t.date < filters.from) return false;
      if (filters.to && t.date > filters.to) return false;
      if (!words.length) return true;
      const text = [
        t.note,
        categoryPath(context.categories, t.categoryId) ?? '',
        accountName.get(t.accountId) ?? '',
        t.toAccountId ? (accountName.get(t.toAccountId) ?? '') : '',
        t.personId ? (personName.get(t.personId) ?? '') : '',
        ...(t.splits ?? []).map((split) => personName.get(split.personId) ?? ''),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return words.every((word) => {
        const amount = searchedAmount(word);
        if (amount !== null && (t.amount === amount || ownShare(t) === amount)) return true;
        return text.includes(word);
      });
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

/** What the results add up to: your own spending and income (repayments and transfers aside). */
export function searchTotals(results: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of results) {
    if (t.kind === 'income') income += ownShare(t);
    else if (t.kind === 'expense') expense += ownShare(t);
    else expense += t.fee;
  }
  return { count: results.length, income, expense };
}
