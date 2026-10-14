import { RpcError } from './rpc';

/** The lists `sync_ledger` saves, in the database's names. */
export type ListKey =
  | 'accounts'
  | 'categories'
  | 'people'
  | 'transactions'
  | 'notes'
  | 'mf_funds'
  | 'mf_sips'
  | 'mf_transactions'
  | 'stocks'
  | 'stock_trades'
  | 'recurring'
  | 'goals'
  | 'employers'
  | 'payslips'
  | 'pf_entries';

export const LIST_KEYS: readonly ListKey[] = [
  'accounts',
  'categories',
  'people',
  'transactions',
  'notes',
  'mf_funds',
  'mf_sips',
  'mf_transactions',
  'stocks',
  'stock_trades',
  'recurring',
  'goals',
  'employers',
  'payslips',
  'pf_entries',
];

/** The `updated_at` the app last saw for each saved row, per list and id. */
export type Versions = Partial<Record<ListKey, Record<string, string>>>;

/** A row the database skipped because it changed or was deleted elsewhere (migration 0020). */
export type Conflict = { list: ListKey; id: string; reason: 'changed' | 'deleted' };

/**
 * What a save reports. `checked`: the database compared versions (migration 0020) and
 * `savedAt` is the new `updated_at` of every row it saved. Without 0020 nothing is checked.
 */
export type SaveResult = { checked: boolean; conflicts: Conflict[]; savedAt: string | null };

export const UNCHECKED: SaveResult = { checked: false, conflicts: [], savedAt: null };

const isList = (value: unknown): value is ListKey => LIST_KEYS.includes(value as ListKey);

/** Reads `updated_at` of every row `load_ledger` returned. */
export function versionsFromRemote(raw: Record<string, unknown> | null): Versions {
  const versions: Versions = {};
  for (const list of LIST_KEYS) {
    const rows = raw?.[list];
    if (!Array.isArray(rows)) continue;
    const map: Record<string, string> = {};
    for (const row of rows as Record<string, unknown>[]) {
      if (typeof row?.id === 'string' && typeof row.updated_at === 'string') {
        map[row.id] = row.updated_at;
      }
    }
    versions[list] = map;
  }
  return versions;
}

/** The answer of `sync_ledger_v2`; anything else (the old void `sync_ledger`) is unchecked. */
export function parseSaveResult(raw: unknown): SaveResult {
  const value = raw as { conflicts?: unknown; saved_at?: unknown } | null;
  if (!value || !Array.isArray(value.conflicts)) return UNCHECKED;
  const conflicts = (value.conflicts as Record<string, unknown>[]).flatMap((item) =>
    isList(item?.list) && typeof item.id === 'string'
      ? [
          {
            list: item.list,
            id: item.id,
            reason: item.reason === 'deleted' ? 'deleted' : 'changed',
          },
        ]
      : [],
  ) as Conflict[];
  const savedAt = typeof value.saved_at === 'string' ? value.saved_at : null;
  return { checked: true, conflicts, savedAt };
}

/** PostgREST answers 404 for a function the database does not have (no migration 0020). */
export const isMissingFunction = (error: unknown) =>
  error instanceof RpcError && error.status === 404;
