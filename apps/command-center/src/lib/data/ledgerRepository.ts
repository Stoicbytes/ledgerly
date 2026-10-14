import type { Account, Category, Person, Transaction } from '@/lib/domain/expenses';
import type { Portfolio } from '@/lib/domain/investments';
import type { Note } from '@/lib/domain/notes';
import { diffById, isEmptyDiff } from '@/lib/domain/sync';
import { accountRow, categoryRow, noteFromRemote, noteRow, personRow } from './ledgerRows';
import { portfolioChanges, portfolioFromRemote, type RemotePortfolio } from './portfolioRows';
import { receiptPhoto, receiptRow } from './receiptRows';
import { extrasChanges, extrasFromRemote, type ExtraKey, type Extras } from './extrasRows';
import { callRpc } from './rpc';
import {
  isMissingFunction,
  parseSaveResult,
  versionsFromRemote,
  type SaveResult,
  type Versions,
} from './saveResult';

/** Everything the app keeps in the cloud for one user. */
export type CloudData = Extras & {
  accounts: Account[];
  categories: Category[];
  people: Person[];
  transactions: Transaction[];
  notes: Note[];
  /** Mutual funds and stocks (migration 0007). */
  portfolio: Portfolio;
  /** Notes keep reminders and Recently deleted (migration 0015). */
  noteExtras?: boolean;
  /** Set by `loadCloudData` only: the `updated_at` of each loaded row. */
  versions?: Versions;
};

type InvestmentKey = 'mf_funds' | 'mf_sips' | 'mf_transactions' | 'stocks' | 'stock_trades';
type LedgerKey = 'accounts' | 'categories' | 'people' | 'transactions' | 'notes';

/** One batch for `sync_ledger`, in the database's column names. */
export type LedgerChanges = Partial<Record<InvestmentKey | LedgerKey | ExtraKey, unknown[]>> & {
  deleted?: Partial<Record<InvestmentKey | LedgerKey | ExtraKey, string[]>>;
};

type Row = Record<string, unknown>;
type Raw = RemotePortfolio &
  Partial<Record<LedgerKey | ExtraKey | 'splits' | 'settles', Row[]>> & { note_extras?: unknown };

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const time = (value: unknown) => {
  const parsed = Date.parse(str(value));
  return Number.isFinite(parsed) ? parsed : 0;
};
const isoTime = (ms: number) => new Date(ms || Date.now()).toISOString();

/** Turns `load_ledger()` output into the app's types. */
export function fromRemote(raw: Raw | null): CloudData {
  const data = raw ?? {};
  const splits = new Map<string, Transaction['splits'] & object>();
  for (const row of data.splits ?? []) {
    const list = splits.get(str(row.transaction_id)) ?? [];
    list.push({ personId: str(row.person_id), amount: num(row.amount) });
    splits.set(str(row.transaction_id), list);
  }
  const settles = new Map<string, string[]>();
  for (const row of data.settles ?? []) {
    const list = settles.get(str(row.repayment_id)) ?? [];
    list.push(str(row.expense_id));
    settles.set(str(row.repayment_id), list);
  }
  return {
    accounts: (data.accounts ?? []).map((row) => ({
      id: str(row.id),
      name: str(row.name),
      group: str(row.account_group) as Account['group'],
      openingBalance: num(row.opening_balance),
      order: num(row.sort_order),
    })),
    categories: (data.categories ?? []).map((row) => ({
      id: str(row.id),
      kind: str(row.kind) as Category['kind'],
      parentId: (row.parent_id as string | null) ?? null,
      name: str(row.name),
      icon: str(row.icon),
      tint: num(row.tint),
      budget: row.budget === null || row.budget === undefined ? null : num(row.budget),
      order: num(row.sort_order),
    })),
    people: (data.people ?? []).map((row) => ({
      id: str(row.id),
      name: str(row.name),
      order: num(row.sort_order),
    })),
    transactions: (data.transactions ?? []).map((row) => {
      const id = str(row.id);
      const photo = receiptPhoto(row.receipt);
      const transaction: Transaction = {
        id,
        kind: str(row.kind) as Transaction['kind'],
        date: str(row.occurred_on),
        amount: num(row.amount),
        accountId: str(row.account_id),
        toAccountId: (row.to_account_id as string | null) ?? null,
        fee: num(row.fee),
        categoryId: (row.category_id as string | null) ?? null,
        note: str(row.note),
        createdAt: time(row.created_at),
        splits: splits.get(id) ?? [],
        personId: (row.person_id as string | null) ?? null,
        settles: settles.get(id) ?? [],
        ...(photo ? { photo } : {}),
      };
      return transaction;
    }),
    notes: (data.notes ?? []).map(noteFromRemote),
    noteExtras: data.note_extras === true,
    portfolio: portfolioFromRemote(data),
    ...extrasFromRemote(data),
  };
}

const transactionRow = (t: Transaction) => ({
  id: t.id,
  kind: t.kind,
  occurred_on: t.date,
  amount: t.amount,
  account_id: t.accountId,
  to_account_id: t.toAccountId,
  fee: t.fee,
  category_id: t.categoryId,
  note: t.note,
  person_id: t.personId ?? null,
  receipt: receiptRow(t.photo),
  created_at: isoTime(t.createdAt),
  splits: (t.splits ?? []).map((s) => ({ person_id: s.personId, amount: s.amount })),
  settles: t.settles ?? [],
});
/** The batch that turns `previous` into `next` in the cloud, or null when nothing changed. */
export function buildChanges(previous: CloudData, next: CloudData): LedgerChanges | null {
  const accounts = diffById(previous.accounts, next.accounts, accountRow);
  const categories = diffById(previous.categories, next.categories, categoryRow);
  const people = diffById(previous.people, next.people, personRow);
  const transactions = diffById(previous.transactions, next.transactions, transactionRow);
  // Edit times alone are not changes; the server keeps its own.
  const notes = diffById(previous.notes, next.notes, noteRow);
  const portfolio = portfolioChanges(previous.portfolio, next.portfolio);
  const extras = extrasChanges(previous, next);
  if (
    isEmptyDiff([
      accounts,
      categories,
      people,
      transactions,
      notes,
      ...extras.diffs,
      ...portfolio.diffs,
    ])
  ) {
    return null;
  }
  return {
    ...portfolio.upserts,
    accounts: accounts.upserts.map(accountRow),
    categories: categories.upserts.map(categoryRow),
    people: people.upserts.map(personRow),
    transactions: transactions.upserts.map(transactionRow),
    notes: notes.upserts.map(noteRow),
    ...extras.upserts,
    deleted: {
      accounts: accounts.deletes,
      categories: categories.deletes,
      people: people.deletes,
      transactions: transactions.deletes,
      notes: notes.deletes,
      ...extras.deletes,
      ...portfolio.deletes,
    },
  };
}

export async function loadCloudData(): Promise<CloudData> {
  const raw = await callRpc<Raw>('load_ledger');
  return { ...fromRemote(raw), versions: versionsFromRemote(raw as Record<string, unknown>) };
}

/** Set once the database answered that it has no `sync_ledger_v2` (migration 0020). */
let legacySave = false;

/**
 * Saves one batch. With migration 0020 rows that changed or were deleted elsewhere are
 * skipped and reported; without it the older `sync_ledger` saves everything as before.
 */
export async function saveChanges(
  changes: LedgerChanges,
  options: { keepalive?: boolean } = {},
): Promise<SaveResult> {
  if (!legacySave) {
    try {
      return parseSaveResult(await callRpc('sync_ledger_v2', { p_changes: changes }, options));
    } catch (error) {
      if (!isMissingFunction(error)) throw error;
      legacySave = true;
    }
  }
  return parseSaveResult(await callRpc<null>('sync_ledger', { p_changes: changes }, options));
}
