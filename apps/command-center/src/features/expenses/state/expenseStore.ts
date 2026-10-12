import { create } from 'zustand';
import type {
  Account,
  AccountGroup,
  Category,
  CategoryKind,
  Person,
  Transaction,
  ValidTransaction,
} from '@/lib/domain/expenses';
import { newId } from '@/lib/ids';
import { useRecurringStore } from './recurringStore';
import { seedAccounts, seedCategories } from './seedCatalog';
import { seedPeople, withSampleSplits } from './seedPeople';
import { seedTransactions } from './seedTransactions';

/**
 * PREVIEW DATA SOURCE (in memory, resets on reload). Every action mirrors a
 * future repository/RPC call (EXPENSE_MANAGER_FLOW.md §9); calculations live
 * in src/lib/domain/expenses and never in this store.
 */
export type Ledger = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  people: Person[];
};

export type CategoryInput = {
  kind: CategoryKind;
  parentId: string | null;
  name: string;
  icon: string;
  tint: number;
  budget: number | null;
};
export type AccountInput = { name: string; group: AccountGroup; openingBalance: number };

type ExpenseStore = Ledger & {
  saveTransaction: (value: ValidTransaction, id?: string | null) => Transaction;
  /**
   * Removes an entry, and its link from repayments that were "for" it (the database
   * drops those links too). `restore` puts everything back for an undo.
   */
  deleteTransaction: (id: string) => { removed: Transaction; restore: Transaction[] } | null;
  restoreTransactions: (items: Transaction[]) => void;
  saveCategory: (input: CategoryInput, id?: string | null) => Category;
  /** Removes a category (and its subcategories); returns the previous ledger for undo. */
  deleteCategory: (id: string, reassignTo: string | null) => Ledger;
  moveCategory: (id: string, direction: -1 | 1) => void;
  setBudget: (id: string, budget: number | null) => void;
  saveAccount: (input: AccountInput, id?: string | null) => Account;
  /** Only unused accounts can be deleted; returns false otherwise. */
  deleteAccount: (id: string) => boolean;
  restoreLedger: (ledger: Ledger) => void;
  resetPreview: () => void;
};

const seed = (): Ledger => ({
  accounts: seedAccounts(),
  categories: seedCategories(),
  transactions: withSampleSplits(seedTransactions()),
  people: seedPeople(),
});

const nextOrder = (items: { order: number }[]) =>
  items.reduce((max, item) => Math.max(max, item.order + 1), 0);

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  ...seed(),

  saveTransaction: (value, id) => {
    const existing = id ? get().transactions.find((item) => item.id === id) : undefined;
    const transaction: Transaction = {
      ...value,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    set((state) => ({
      transactions: existing
        ? state.transactions.map((item) => (item.id === existing.id ? transaction : item))
        : [...state.transactions, transaction],
    }));
    return transaction;
  },

  deleteTransaction: (id) => {
    const removed = get().transactions.find((item) => item.id === id);
    if (!removed) return null;
    const linked = get().transactions.filter((item) => item.settles?.includes(id));
    set((state) => ({
      transactions: state.transactions
        .filter((item) => item.id !== id)
        .map((item) =>
          item.settles?.includes(id)
            ? { ...item, settles: item.settles.filter((other) => other !== id) }
            : item,
        ),
    }));
    return { removed, restore: [removed, ...linked] };
  },

  restoreTransactions: (items) =>
    set((state) => {
      const ids = new Set(items.map((item) => item.id));
      return {
        transactions: [...state.transactions.filter((item) => !ids.has(item.id)), ...items],
      };
    }),

  saveCategory: (input, id) => {
    const existing = id ? get().categories.find((item) => item.id === id) : undefined;
    const siblings = get().categories.filter(
      (item) => item.kind === input.kind && item.parentId === input.parentId,
    );
    const category: Category = {
      ...input,
      name: input.name.trim(),
      budget: input.parentId === null && input.kind === 'expense' ? input.budget : null,
      id: existing?.id ?? newId(),
      order: existing?.order ?? nextOrder(siblings),
    };
    set((state) => ({
      categories: existing
        ? state.categories.map((item) => {
            if (item.id === category.id) return category;
            // Subcategories inherit the parent's icon and colour.
            return item.parentId === category.id
              ? { ...item, icon: category.icon, tint: category.tint }
              : item;
          })
        : [...state.categories, category],
    }));
    return category;
  },

  deleteCategory: (id, reassignTo) => {
    const previous = getLedger();
    const target = previous.categories.find((item) => item.id === id);
    if (!target) return previous;
    const removed = new Set([
      id,
      ...previous.categories.filter((item) => item.parentId === id).map((item) => item.id),
    ]);
    // A subcategory's entries fall back to its parent; a top-level category's go to the
    // chosen category of the same kind (never one being deleted), or become uncategorised.
    const candidate = previous.categories.find((item) => item.id === reassignTo);
    const validTarget =
      candidate && candidate.kind === target.kind && !removed.has(candidate.id)
        ? candidate.id
        : null;
    const destination = target.parentId ?? validTarget;
    set({
      categories: previous.categories.filter((item) => !removed.has(item.id)),
      transactions: previous.transactions.map((item) =>
        item.categoryId && removed.has(item.categoryId)
          ? { ...item, categoryId: destination }
          : item,
      ),
    });
    return previous;
  },

  moveCategory: (id, direction) =>
    set((state) => {
      const target = state.categories.find((item) => item.id === id);
      if (!target) return state;
      const siblings = state.categories
        .filter((item) => item.kind === target.kind && item.parentId === target.parentId)
        .sort((a, b) => a.order - b.order);
      const index = siblings.findIndex((item) => item.id === id);
      const swap = siblings[index + direction];
      if (!swap) return state;
      return {
        categories: state.categories.map((item) =>
          item.id === target.id
            ? { ...item, order: swap.order }
            : item.id === swap.id
              ? { ...item, order: target.order }
              : item,
        ),
      };
    }),

  setBudget: (id, budget) =>
    set((state) => ({
      categories: state.categories.map((item) => (item.id === id ? { ...item, budget } : item)),
    })),

  saveAccount: (input, id) => {
    const existing = id ? get().accounts.find((item) => item.id === id) : undefined;
    const account: Account = {
      ...input,
      name: input.name.trim(),
      id: existing?.id ?? newId(),
      order: existing?.order ?? nextOrder(get().accounts),
    };
    set((state) => ({
      accounts: existing
        ? state.accounts.map((item) => (item.id === account.id ? account : item))
        : [...state.accounts, account],
    }));
    return account;
  },

  deleteAccount: (id) => {
    const used =
      get().transactions.some((item) => item.accountId === id || item.toAccountId === id) ||
      useRecurringStore
        .getState()
        .rules.some((rule) => rule.accountId === id || rule.toAccountId === id);
    if (used) return false;
    set((state) => ({ accounts: state.accounts.filter((item) => item.id !== id) }));
    return true;
  },

  restoreLedger: (ledger) => set(ledger),
  resetPreview: () => set(seed()),
}));

/** Reads the current ledger outside React (e.g. inside other stores). */
export const getLedger = (): Ledger => {
  const { accounts, categories, transactions, people } = useExpenseStore.getState();
  return { accounts, categories, transactions, people };
};
