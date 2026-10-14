import { addDays } from './dates';
import type { Category, CategoryKind, Transaction } from './types';

/** Shortcuts appear once this many categories have been used in the window. */
export const FREQUENT_MIN = 4;
export const FREQUENT_MAX = 6;

/**
 * The categories of `kind` used most in the last `days` days (most entries first, then
 * the latest use), for the shortcuts above the category grid. Without subcategories a
 * subcategory's entries count for its parent. Deleted categories never appear.
 */
export function frequentCategories(
  transactions: Transaction[],
  categories: Category[],
  kind: CategoryKind,
  today: string,
  { days = 90, withSubcategories = true } = {},
): Category[] {
  const from = addDays(today, -days);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const uses = new Map<string, { count: number; last: string }>();
  for (const transaction of transactions) {
    if (transaction.kind !== kind || transaction.date < from || transaction.date > today) continue;
    let category = transaction.categoryId ? byId.get(transaction.categoryId) : undefined;
    if (category?.parentId && !withSubcategories) category = byId.get(category.parentId);
    if (!category || category.kind !== kind) continue;
    const use = uses.get(category.id) ?? { count: 0, last: '' };
    uses.set(category.id, {
      count: use.count + 1,
      last: transaction.date > use.last ? transaction.date : use.last,
    });
  }
  if (uses.size < FREQUENT_MIN) return [];
  return [...uses.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, FREQUENT_MAX)
    .map(([id]) => byId.get(id) as Category);
}
