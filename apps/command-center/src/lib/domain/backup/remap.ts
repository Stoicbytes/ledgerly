import type { RestoreKind } from './kinds';

type Item = { id: string } & Record<string, unknown>;
type Ids = Map<string, string>;

const to = (ids: Ids, id: unknown) =>
  typeof id === 'string' ? (ids.get(id) ?? id) : (id as string | null);

/** Reference fields per kind (records the file names by id). */
const REFS: Partial<Record<RestoreKind, string[]>> = {
  categories: ['parentId'],
  transactions: ['accountId', 'toAccountId', 'categoryId', 'personId'],
  recurring: ['accountId', 'toAccountId', 'categoryId'],
  trades: ['stockId'],
};

/**
 * A record with its references pointing at the records used here: when a backup's
 * account, person, category or share is matched to one here by name, everything that
 * uses it follows.
 */
export function remapped<T extends { id: string }>(kind: RestoreKind, item: T, ids: Ids): T {
  const fields = REFS[kind];
  if (!fields || !ids.size) return item;
  const out = { ...item } as unknown as Item;
  for (const field of fields) if (field in out) out[field] = to(ids, out[field]);
  if (kind === 'transactions' && Array.isArray(out.splits)) {
    out.splits = (out.splits as { personId: string; amount: number }[]).map((split) => ({
      ...split,
      personId: to(ids, split.personId) as string,
    }));
  }
  return out as unknown as T;
}
