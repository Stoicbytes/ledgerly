/** Rows added or changed, and ids removed, between two snapshots of one collection. */
export type CollectionDiff<T> = { upserts: T[]; deletes: string[] };

/**
 * Compares two lists of rows by id. `key` reduces a row to what is stored, so fields
 * kept only on the device (like a picked photo's local file) do not count as changes.
 */
export function diffById<T extends { id: string }>(
  previous: readonly T[],
  next: readonly T[],
  key: (row: T) => unknown = (row) => row,
): CollectionDiff<T> {
  const before = new Map(previous.map((row) => [row.id, JSON.stringify(key(row))]));
  const after = new Set(next.map((row) => row.id));
  return {
    upserts: next.filter((row) => before.get(row.id) !== JSON.stringify(key(row))),
    deletes: previous.filter((row) => !after.has(row.id)).map((row) => row.id),
  };
}

export const isEmptyDiff = (diffs: CollectionDiff<unknown>[]) =>
  diffs.every((diff) => diff.upserts.length === 0 && diff.deletes.length === 0);
