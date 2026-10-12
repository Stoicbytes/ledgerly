import type { Category, CategoryKind, Transaction } from './types';

export const UNCATEGORIZED_ID = '__uncategorized';
export const TRANSFER_FEES_ID = '__fees';
export const OTHER_ID = '__other';

const byOrder = (a: Category, b: Category) => a.order - b.order || a.name.localeCompare(b.name);

export function topLevelCategories(categories: Category[], kind: CategoryKind): Category[] {
  return categories
    .filter((category) => category.kind === kind && category.parentId === null)
    .sort(byOrder);
}

export function subcategoriesOf(categories: Category[], parentId: string): Category[] {
  return categories.filter((category) => category.parentId === parentId).sort(byOrder);
}

/** The top-level category and (optional) subcategory for a leaf id. */
export function resolveCategory(categories: Category[], id: string | null) {
  const leaf = id ? categories.find((category) => category.id === id) : undefined;
  if (!leaf) return { parent: null, sub: null } as const;
  if (leaf.parentId === null) return { parent: leaf, sub: null } as const;
  return {
    parent: categories.find((category) => category.id === leaf.parentId) ?? null,
    sub: leaf,
  } as const;
}

/** "Food › Tea", "Rent", or null. */
export function categoryPath(categories: Category[], id: string | null): string | null {
  const { parent, sub } = resolveCategory(categories, id);
  if (!parent) return null;
  return sub ? `${parent.name} › ${sub.name}` : parent.name;
}

/**
 * Categories of one kind whose name contains `query` (case-insensitive):
 * matching top-level categories first, then matching subcategories, each in
 * their saved order. An empty query matches nothing.
 */
export function searchCategories(categories: Category[], kind: CategoryKind, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const parents = topLevelCategories(categories, kind);
  const matches = (category: Category) => category.name.toLocaleLowerCase().includes(needle);
  return [
    ...parents.filter(matches),
    ...parents.flatMap((parent) => subcategoriesOf(categories, parent.id).filter(matches)),
  ];
}

/**
 * How many income/expense entries use each category. A top-level category's
 * count includes its subcategories' entries (it is what deleting it affects).
 */
export function entryCounts(transactions: Transaction[], categories: Category[]) {
  const parentOf = new Map(categories.map((category) => [category.id, category.parentId]));
  const counts = new Map<string, number>();
  const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const transaction of transactions) {
    if (transaction.kind === 'transfer' || !transaction.categoryId) continue;
    if (!parentOf.has(transaction.categoryId)) continue;
    bump(transaction.categoryId);
    const parent = parentOf.get(transaction.categoryId);
    if (parent) bump(parent);
  }
  return counts;
}
