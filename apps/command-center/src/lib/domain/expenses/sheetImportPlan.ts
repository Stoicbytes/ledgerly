import type { SheetRead, SheetRow } from './sheetImport';
import { SKIP_REASONS } from './sheetImport';
import { guessAccountGroup, guessCategoryIcon } from './sheetImportGuess';
import type { Account, Category, CategoryKind, Transaction } from './types';

/**
 * What importing a sheet would add: new accounts and categories (matched to yours by name,
 * ignoring case, spaces and emoji), the entries, and what is left out. Entries already in your
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
  transfers: number;
  /** Balance corrections added to new accounts' opening balances. */
  corrections: { account: string; amount: number }[];
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

/** Emoji (with their skin-tone, joiner and variation marks) are left out of names. */
const EMOJI =
  /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200d\ufe0f\u20e3]/gu;

/** Without emoji, trimmed, single-spaced and cut to `max` characters. */
export const cleanName = (name: string, max: number) =>
  Array.from(name.replace(EMOJI, '').trim().replace(/\s+/g, ' ')).slice(0, max).join('').trim();
/** Names match ignoring case, spaces and emoji ("🍔 Food" is Food). */
const key = (name: string) => cleanName(name, Number.MAX_SAFE_INTEGER).toLowerCase();
const noteKey = (note: string) => note.trim().replace(/\s+/g, ' ').toLowerCase();
const nextOrder = (items: { order: number }[]) =>
  items.reduce((max, item) => Math.max(max, item.order + 1), 0);
const TINTS = 8;

type EntryKeyPart = Pick<Transaction, 'date' | 'kind' | 'amount' | 'accountId' | 'note'> & {
  toAccountId: string | null;
};
const entryKey = (t: EntryKeyPart) =>
  `${t.date}|${t.kind}|${t.amount}|${t.accountId}|${t.toAccountId ?? ''}|${noteKey(t.note)}`;
/** One transfer as both sides of a Money Manager export describe it. */
const transferKey = (row: SheetRow) =>
  `${row.date}|${row.amount}|${key(row.account)}|${key(row.toAccount)}`;

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
    skipped: [...read.skipped],
    range: null,
    income: 0,
    expense: 0,
    remaining: 0,
    transfers: 0,
    corrections: [],
  };

  const accountFor = (raw: string) => {
    const name = cleanName(raw, ACCOUNT_NAME) || 'Imported';
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

  // A Transfer-In row repeating a Transfer-Out row of the same transfer adds nothing.
  const outs = new Map<string, number>();
  for (const row of read.rows) {
    if (row.kind === 'transfer' && row.side === 'out') {
      outs.set(transferKey(row), (outs.get(transferKey(row)) ?? 0) + 1);
    }
  }
  const startingAccounts = new Set(accounts.map((item) => item.id));
  const corrected = new Map<string, number>();

  for (const row of [...read.rows].sort((a, b) => a.at - b.at)) {
    if (row.kind === 'transfer' && row.side === 'in') {
      const mirrors = outs.get(transferKey(row)) ?? 0;
      if (mirrors > 0) {
        outs.set(transferKey(row), mirrors - 1);
        continue;
      }
    }
    const accountId = accountFor(row.account);
    if (row.kind === 'balance') {
      // Only an account this import creates: correcting an existing one twice on a second
      // import would be wrong, and its balance is better set by hand.
      if (startingAccounts.has(accountId)) {
        plan.skipped.push({ line: row.line, reason: SKIP_REASONS.balance });
      } else {
        corrected.set(accountId, (corrected.get(accountId) ?? 0) + row.direction * row.amount);
      }
      continue;
    }
    const toAccountId = row.kind === 'transfer' ? accountFor(row.toAccount) : null;
    const kind = row.kind;
    const match = entryKey({ ...row, kind, accountId, toAccountId });
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
    // A name that is only emoji is no category: the entry stays, uncategorised or under the parent.
    const parent =
      kind !== 'transfer' && key(row.category) ? categoryFor(kind, row.category, null) : null;
    const leaf =
      parent && kind !== 'transfer' && key(row.subcategory)
        ? categoryFor(kind, row.subcategory, parent)
        : parent;
    plan.transactions.push({
      id: newId(),
      kind,
      date: row.date,
      amount: row.amount,
      accountId,
      toAccountId,
      fee: 0,
      categoryId: leaf?.id ?? null,
      note: row.note,
      createdAt: row.at,
    });
    if (kind === 'transfer') plan.transfers += 1;
    else plan[kind] += row.amount;
  }

  for (const account of plan.accounts) {
    const amount = corrected.get(account.id);
    if (amount === undefined) continue;
    account.openingBalance = amount;
    plan.corrections.push({ account: account.name, amount });
  }
  // Only accounts that new entries or corrections use (a file of duplicates adds nothing).
  const used = new Set([
    ...plan.transactions.flatMap((item) => [item.accountId, item.toAccountId ?? '']),
    ...corrected.keys(),
  ]);
  plan.accounts = plan.accounts.filter((item) => used.has(item.id));
  const dates = plan.transactions.map((item) => item.date).sort();
  if (dates.length) plan.range = { start: dates[0], end: dates[dates.length - 1] };
  return plan;
}
