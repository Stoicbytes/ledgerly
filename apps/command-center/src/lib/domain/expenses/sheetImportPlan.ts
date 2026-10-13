import type { SheetRead } from './sheetImport';
import type { RecurringEntry } from './recurring';
import type { Account, AccountGroup, Category, CategoryKind, Transaction } from './types';

/**
 * What importing a sheet would add: new accounts and categories (matched to yours by name,
 * ignoring case and spaces), the entries, and what is left out. Entries already in your
 * ledger (same day, type, amount, account and note) are skipped, so a file can be imported
 * again safely.
 */
export type SheetImportPlan = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  /** Rows matching entries you already have. */
  duplicates: number;
  skipped: SheetRead['skipped'];
  range: { start: string; end: string } | null;
  income: number;
  expense: number;
  /** New entries beyond one import's limit: importing the same file again adds them. */
  remaining: number;
};

/**
 * One import stays well inside what a single save accepts (5,000 rows per list); the
 * oldest entries go first and the rest follow when the same file is imported again.
 */
export const MAX_IMPORT_ENTRIES = 4000;
/** The database's name limits (accounts 60 characters, categories 40). */
const ACCOUNT_NAME = 60;
const CATEGORY_NAME = 40;

type Ledger = { accounts: Account[]; categories: Category[]; transactions: Transaction[] };

/** Trimmed, single-spaced and cut to `max` characters (emoji count as one). */
export const cleanName = (name: string, max: number) =>
  Array.from(name.trim().replace(/\s+/g, ' ')).slice(0, max).join('').trim();
const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const nextOrder = (items: { order: number }[]) =>
  items.reduce((max, item) => Math.max(max, item.order + 1), 0);
const TINTS = 8;

/** A new account's type from its name; anything unclear is a bank account. */
export function guessAccountGroup(name: string): AccountGroup {
  const lower = name.toLowerCase();
  if (/cash/.test(lower)) return 'cash';
  if (/card|credit/.test(lower)) return 'card';
  if (/wallet|paytm|phonepe|gpay|amazon pay/.test(lower)) return 'wallet';
  return 'bank';
}

const ICON_WORDS: [RegExp, string][] = [
  [/food|tea|snack|restaurant|grocer/, 'food'],
  [/transport|travel|cab|bus|train|petrol|fuel/, 'transport'],
  [/rent|house|home/, 'home'],
  [/social|friend|party/, 'social'],
  [/sport|gym|fitness/, 'sports'],
  [/hometown/, 'hometown'],
  [/mobile|phone|recharge/, 'mobile'],
  [/household/, 'household'],
  [/groom|salon|beauty/, 'grooming'],
  [/family|dad|mom|parent/, 'family'],
  [/gadget|electronic/, 'gadgets'],
  [/gift/, 'gift'],
  [/shop/, 'shops'],
  [/medic|pharma|doctor|health/, 'medicine'],
  [/station/, 'stationery'],
  [/salary|bonus/, 'salary'],
  [/bill|card/, 'bills'],
  [/saving|interest/, 'interest'],
];

export const guessCategoryIcon = (name: string) =>
  ICON_WORDS.find(([pattern]) => pattern.test(name.toLowerCase()))?.[1] ?? 'other';

const entryKey = (t: Pick<Transaction, 'date' | 'kind' | 'amount' | 'accountId' | 'note'>) =>
  `${t.date}|${t.kind}|${t.amount}|${t.accountId}|${key(t.note)}`;

export function planSheetImport(
  read: SheetRead,
  ledger: Ledger,
  newId: () => string,
): SheetImportPlan {
  const accounts = [...ledger.accounts];
  const categories = [...ledger.categories];
  const plan: SheetImportPlan = {
    accounts: [],
    categories: [],
    transactions: [],
    duplicates: 0,
    skipped: read.skipped,
    range: null,
    income: 0,
    expense: 0,
    remaining: 0,
  };

  const accountFor = (raw: string) => {
    const name = cleanName(raw, ACCOUNT_NAME);
    const found = accounts.find((item) => key(item.name) === key(name));
    if (found) return found.id;
    const account: Account = {
      id: newId(),
      name,
      group: guessAccountGroup(name),
      openingBalance: 0,
      order: nextOrder(accounts),
    };
    accounts.push(account);
    plan.accounts.push(account);
    return account.id;
  };

  const categoryFor = (kind: CategoryKind, raw: string, parent: Category | null) => {
    const name = cleanName(raw, CATEGORY_NAME);
    const found = categories.find(
      (item) =>
        item.kind === kind &&
        item.parentId === (parent?.id ?? null) &&
        key(item.name) === key(name),
    );
    if (found) return found;
    const siblings = categories.filter(
      (item) => item.kind === kind && item.parentId === (parent?.id ?? null),
    );
    const topLevel = categories.filter((item) => item.parentId === null).length;
    const category: Category = {
      id: newId(),
      kind,
      parentId: parent?.id ?? null,
      name,
      icon: parent?.icon ?? guessCategoryIcon(name),
      tint: parent?.tint ?? topLevel % TINTS,
      budget: null,
      order: nextOrder(siblings),
    };
    categories.push(category);
    plan.categories.push(category);
    return category;
  };

  // Entries you already have, counted so two identical teas on one day stay two.
  const existing = new Map<string, number>();
  for (const item of ledger.transactions) {
    existing.set(entryKey(item), (existing.get(entryKey(item)) ?? 0) + 1);
  }

  for (const row of [...read.rows].sort((a, b) => a.at - b.at)) {
    const accountId = accountFor(row.account);
    const match = entryKey({ ...row, accountId });
    const left = existing.get(match) ?? 0;
    if (left > 0) {
      existing.set(match, left - 1);
      plan.duplicates += 1;
      continue;
    }
    if (plan.transactions.length >= MAX_IMPORT_ENTRIES) {
      plan.remaining += 1;
      continue;
    }
    const parent = row.category ? categoryFor(row.kind, row.category, null) : null;
    const leaf =
      parent && row.subcategory ? categoryFor(row.kind, row.subcategory, parent) : parent;
    plan.transactions.push({
      id: newId(),
      kind: row.kind,
      date: row.date,
      amount: row.amount,
      accountId,
      toAccountId: null,
      fee: 0,
      categoryId: leaf?.id ?? null,
      note: row.note,
      createdAt: row.at,
    });
    plan[row.kind] += row.amount;
  }

  // Only accounts that new entries use (a file of duplicates adds nothing).
  const used = new Set(plan.transactions.map((item) => item.accountId));
  plan.accounts = plan.accounts.filter((item) => used.has(item.id));
  const dates = plan.transactions.map((item) => item.date).sort();
  if (dates.length) plan.range = { start: dates[0], end: dates[dates.length - 1] };
  return plan;
}

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
