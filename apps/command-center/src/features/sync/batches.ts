import type { LedgerChanges } from '@/lib/data/ledgerRepository';
import type { ListKey, Versions } from '@/lib/data/saveResult';

/**
 * Shapes the batches sent to the database: large saves go in parts under its 5,000-row
 * limit per list, and a batch it refuses is split until the refused rows are found.
 * The order is the database's own, so a part never needs a row from a later part:
 * accounts, people and categories (parents first) before the entries using them, and
 * every delete last.
 */
export const MAX_ROWS_PER_LIST = 4000;

const SAVE_ORDER: ListKey[] = [
  'accounts',
  'people',
  'categories',
  'transactions',
  'recurring',
  'notes',
  'goals',
  'mf_funds',
  'mf_sips',
  'mf_transactions',
  'stocks',
  'stock_trades',
  'employers',
  'payslips',
  'pf_entries',
];
const DELETE_ORDER: ListKey[] = [
  'pf_entries',
  'payslips',
  'recurring',
  'transactions',
  'notes',
  'categories',
  'people',
  'accounts',
  'mf_transactions',
  'mf_sips',
  'mf_funds',
  'goals',
  'stock_trades',
  'stocks',
  'employers',
];

type Row = Record<string, unknown>;
/** One row to save (`row`) or one id to delete. */
export type Op = { list: ListKey; id: string; row?: Row };

const rowsOf = (changes: LedgerChanges, list: ListKey) => (changes[list] ?? []) as Row[];

export function toOps(changes: LedgerChanges): Op[] {
  const saves = SAVE_ORDER.flatMap((list) => {
    const rows = rowsOf(changes, list);
    // Top-level categories first, so subcategories find their parent.
    const ordered =
      list === 'categories'
        ? [...rows].sort((a, b) => Number(!!a.parent_id) - Number(!!b.parent_id))
        : rows;
    return ordered.map((row) => ({ list, id: String(row.id), row }));
  });
  const deletes = DELETE_ORDER.flatMap((list) =>
    (changes.deleted?.[list] ?? []).map((id) => ({ list, id: String(id) })),
  );
  return [...saves, ...deletes];
}

export function fromOps(ops: Op[]): LedgerChanges {
  const changes: LedgerChanges = {};
  const deleted: NonNullable<LedgerChanges['deleted']> = {};
  for (const op of ops) {
    if (op.row) changes[op.list] = [...(changes[op.list] ?? []), op.row];
    else deleted[op.list] = [...(deleted[op.list] ?? []), op.id];
  }
  if (Object.keys(deleted).length) changes.deleted = deleted;
  return changes;
}

/** Parts of at most `max` rows per list; deletes travel with the last part. */
export function chunkChanges(changes: LedgerChanges, max = MAX_ROWS_PER_LIST): LedgerChanges[] {
  const longest = Math.max(0, ...SAVE_ORDER.map((list) => rowsOf(changes, list).length));
  if (longest <= max) return [changes];
  const ops = toOps(changes);
  const parts = Math.ceil(longest / max);
  const seen = new Map<ListKey, number>();
  const groups: Op[][] = Array.from({ length: parts }, () => []);
  for (const op of ops) {
    if (!op.row) {
      groups[parts - 1].push(op);
      continue;
    }
    const index = seen.get(op.list) ?? 0;
    seen.set(op.list, index + 1);
    groups[Math.floor(index / max)].push(op);
  }
  return groups.map(fromOps);
}

/**
 * Two halves of a refused batch, split between lists when it holds several (per list
 * first, then per row), or null for a single row.
 */
export function halves(changes: LedgerChanges): [LedgerChanges, LedgerChanges] | null {
  const ops = toOps(changes);
  if (ops.length < 2) return null;
  const middle = ops.length / 2;
  const between = ops
    .map((_, i) => i)
    .filter((i) => i > 0 && (ops[i].list !== ops[i - 1].list || !ops[i].row !== !ops[i - 1].row));
  const cut = between.length
    ? between.reduce((best, i) => (Math.abs(i - middle) < Math.abs(best - middle) ? i : best))
    : Math.floor(middle);
  return [fromOps(ops.slice(0, cut)), fromOps(ops.slice(cut))];
}

/** Marks each row the database already has with the `updated_at` the app last saw. */
export function withBases(changes: LedgerChanges, versions: Versions): LedgerChanges {
  const result: LedgerChanges = { ...changes };
  for (const list of SAVE_ORDER) {
    const known = versions[list];
    if (!known || !changes[list]) continue;
    result[list] = rowsOf(changes, list).map((row) => {
      const base = known[String(row.id)];
      return base ? { ...row, base_updated_at: base } : row;
    });
  }
  return result;
}
