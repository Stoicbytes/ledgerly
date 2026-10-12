import { seedCategories } from '@/features/expenses/state/seedCatalog';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import type { Account, Category } from '@/lib/domain/expenses';
import { newId } from '@/lib/ids';

/**
 * A fresh account's starting point: the usual categories (no budgets, which are the
 * owner's own numbers) and a Cash account at zero. Ids are new UUIDs; nothing from the
 * preview sample (entries, balances, people) is copied.
 */
export function addStarterLedger(): void {
  const ids = new Map<string, string>();
  const idFor = (id: string) => {
    if (!ids.has(id)) ids.set(id, newId());
    return ids.get(id)!;
  };
  const categories: Category[] = seedCategories().map((category) => ({
    ...category,
    id: idFor(category.id),
    parentId: category.parentId ? idFor(category.parentId) : null,
    budget: null,
  }));
  const cash: Account = { id: newId(), name: 'Cash', group: 'cash', openingBalance: 0, order: 0 };
  useExpenseStore.setState((state) => ({
    categories: [...state.categories, ...categories],
    accounts: state.accounts.length ? state.accounts : [cash],
  }));
}
