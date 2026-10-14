import type { Category, Transaction } from './types';

type Ledger = { categories: Category[]; transactions: Transaction[] };

/**
 * Undo of a category delete that puts back only what the delete changed: the removed
 * categories, and the category of each entry it moved (unless the entry was changed or
 * deleted since). Everything added or edited after the delete stays.
 */
export function undoCategoryDelete<T extends Ledger>(before: Ledger, after: Ledger, now: T): T {
  const remaining = new Set(after.categories.map((item) => item.id));
  const present = new Set(now.categories.map((item) => item.id));
  const removed = before.categories.filter(
    (item) => !remaining.has(item.id) && !present.has(item.id),
  );
  const previous = new Map(before.transactions.map((item) => [item.id, item]));
  const moved = new Map(
    after.transactions
      .filter((item) => previous.get(item.id)?.categoryId !== item.categoryId)
      .map((item) => [item.id, item]),
  );
  return {
    ...now,
    categories: [...now.categories, ...removed],
    transactions: now.transactions.map((item) => {
      const atDelete = moved.get(item.id);
      // Changed since the delete in any way: the later edit wins.
      if (!atDelete || (atDelete !== item && JSON.stringify(atDelete) !== JSON.stringify(item))) {
        return item;
      }
      return { ...item, categoryId: previous.get(item.id)?.categoryId ?? null };
    }),
  };
}
