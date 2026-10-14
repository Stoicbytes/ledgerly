import type { LedgerData } from '@/lib/domain/backup';
import { EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { buildChanges, saveChanges, type LedgerChanges } from './ledgerRepository';

/**
 * A restore's records as `sync_ledger` batches: the same rows a normal save sends
 * (built by buildChanges from nothing to the records), one list per batch, in an order
 * where everything a row refers to is saved before it, and at most 4,000 rows or about
 * 4 MB per batch (the database takes 5,000 rows and 5 MB per call). Nothing is deleted.
 */
export const MAX_BATCH_ROWS = 4000;
const MAX_BATCH_CHARS = 4_000_000;

type Key = Exclude<keyof LedgerChanges, 'deleted'>;
type Row = Record<string, unknown>;

const ORDER: Key[] = [
  'accounts',
  'people',
  'categories',
  'goals',
  'notes',
  'employers',
  'stocks',
  'mf_funds',
  'mf_sips',
  'mf_transactions',
  'stock_trades',
  'transactions',
  'recurring',
  'payslips',
  'pf_entries',
];

const KIND_RANK: Record<string, number> = { buy: 0, bonus: 1, split: 2, sell: 3, dividend: 4 };

/** Parents before subcategories, expenses before the repayments that settle them, and
 * investment history in date order (each batch must leave holdings valid on its own). */
function sorted(key: Key, rows: Row[]): Row[] {
  const by = (score: (row: Row) => string | number) =>
    [...rows].sort((a, b) => {
      const x = score(a);
      const y = score(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  if (key === 'categories') return by((row) => (row.parent_id ? 1 : 0));
  if (key === 'transactions') return by((row) => ((row.settles as unknown[]).length ? 1 : 0));
  if (key === 'mf_transactions' || key === 'stock_trades') {
    return by((row) => `${row.trade_date}|${KIND_RANK[String(row.kind)] ?? 9}`);
  }
  return rows;
}

const EMPTY: LedgerData = {
  accounts: [],
  categories: [],
  people: [],
  transactions: [],
  notes: [],
  portfolio: EMPTY_PORTFOLIO,
};

export function restoreBatches(add: LedgerData): LedgerChanges[] {
  const changes = buildChanges({ ...EMPTY }, { ...add });
  if (!changes) return [];
  const batches: LedgerChanges[] = [];
  for (const key of ORDER) {
    let batch: Row[] = [];
    let size = 0;
    for (const row of sorted(key, (changes[key] ?? []) as Row[])) {
      const length = JSON.stringify(row).length;
      if (batch.length && (batch.length >= MAX_BATCH_ROWS || size + length > MAX_BATCH_CHARS)) {
        batches.push({ [key]: batch });
        batch = [];
        size = 0;
      }
      batch.push(row);
      size += length;
    }
    if (batch.length) batches.push({ [key]: batch });
  }
  return batches;
}

/** Sends the batches one after another; `onProgress` hears how many are saved. */
export async function saveRestoreBatches(
  batches: LedgerChanges[],
  onProgress: (saved: number) => void = () => undefined,
): Promise<void> {
  for (let index = 0; index < batches.length; index += 1) {
    await saveChanges(batches[index]);
    onProgress(index + 1);
  }
}
