import type { RecurringEntry } from './recurring';
import type { Account, Category, Transaction } from './types';

type Ledger = { accounts: Account[]; categories: Category[]; transactions: Transaction[] };

/** The ledger with an approved plan's accounts, categories and entries added. */
export const withImported = <T extends Ledger>(ledger: T, items: Ledger): T => ({
  ...ledger,
  accounts: [...ledger.accounts, ...items.accounts],
  categories: [...ledger.categories, ...items.categories],
  transactions: [...ledger.transactions, ...items.transactions],
});

/**
 * Takes an import back: its entries go, and the accounts and categories it created go
 * too unless something added since still uses them. Repayments keep no link to removed
 * entries.
 */
export function withoutImported<T extends Ledger>(
  ledger: T,
  imported: Ledger,
  rules: readonly RecurringEntry[],
): T {
  const gone = new Set(imported.transactions.map((item) => item.id));
  const transactions = ledger.transactions
    .filter((item) => !gone.has(item.id))
    .map((item) =>
      item.settles?.some((id) => gone.has(id))
        ? { ...item, settles: item.settles.filter((id) => !gone.has(id)) }
        : item,
    );
  const usedCategories = new Set<string | null>([
    ...transactions.map((item) => item.categoryId),
    ...rules.map((rule) => rule.categoryId),
  ]);
  const usedAccounts = new Set<string | null>(
    [...transactions, ...rules].flatMap((item) => [item.accountId, item.toAccountId]),
  );
  const newCategories = new Set(imported.categories.map((item) => item.id));
  // A created category stays when it, or a subcategory under it that stays, is in use.
  const keepCategory = (id: string): boolean =>
    !newCategories.has(id) ||
    usedCategories.has(id) ||
    ledger.categories.some((item) => item.parentId === id && keepCategory(item.id));
  const newAccounts = new Set(imported.accounts.map((item) => item.id));
  return {
    ...ledger,
    transactions,
    categories: ledger.categories.filter((item) => keepCategory(item.id)),
    accounts: ledger.accounts.filter(
      (item) => !newAccounts.has(item.id) || usedAccounts.has(item.id),
    ),
  };
}
