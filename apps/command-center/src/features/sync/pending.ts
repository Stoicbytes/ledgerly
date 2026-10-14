import type { CloudData, LedgerChanges } from '@/lib/data/ledgerRepository';
import { LIST_KEYS, type ListKey, type Versions } from '@/lib/data/saveResult';
import { dropItem, listOf, putItem } from './lists';
import { clearPending, readPending, writePending } from './pendingStore';

/**
 * Changes not yet saved, kept on this device for the same user's next visit: the items
 * as they are in the app (`put`), the ids deleted (`drop`), and the `updated_at` each
 * row had when it was edited (`bases`), so a row changed or deleted elsewhere meanwhile
 * is not overwritten or brought back.
 */
type Entry = { put: { id: string }[]; drop: string[]; bases: Record<string, string> };
type PendingRecord = { v: 1; userId: string; lists: Partial<Record<ListKey, Entry>> };

export function keepPending(
  userId: string,
  next: CloudData,
  changes: LedgerChanges,
  versions: Versions,
): void {
  const lists: PendingRecord['lists'] = {};
  for (const list of LIST_KEYS) {
    const ids = new Set(((changes[list] ?? []) as { id?: unknown }[]).map((row) => String(row.id)));
    const drop = (changes.deleted?.[list] ?? []).map(String);
    if (!ids.size && !drop.length) continue;
    const put = (listOf(next, list) ?? []).filter((item) => ids.has(item.id));
    const bases: Record<string, string> = {};
    for (const id of [...ids, ...drop]) {
      const base = versions[list]?.[id];
      if (base) bases[id] = base;
    }
    lists[list] = { put, drop, bases };
  }
  const record: PendingRecord = { v: 1, userId, lists };
  writePending(userId, JSON.stringify(record));
}

export const forgetPending = (userId: string) => clearPending(userId);

const sameTime = (a: string | undefined, b: string | undefined) =>
  a !== undefined && b !== undefined && (a === b || Date.parse(a) === Date.parse(b));

/**
 * Puts the changes kept from this user's last visit back into freshly loaded data.
 * `applied` counts the changes put back; `skipped` those left out because the row was
 * changed or deleted elsewhere since. Never reads another user's entry.
 */
export function replayPending(
  userId: string,
  data: CloudData,
  versions: Versions,
): { data: CloudData; applied: number; skipped: number } {
  let record: PendingRecord | null = null;
  try {
    record = JSON.parse(readPending(userId) ?? 'null') as PendingRecord | null;
  } catch {
    record = null;
  }
  let result = data;
  let applied = 0;
  let skipped = 0;
  if (!record || record.v !== 1 || record.userId !== userId) return { data, applied, skipped };
  for (const list of LIST_KEYS) {
    const entry = record.lists[list];
    if (!entry || !listOf(result, list)) continue;
    // A row edited when it already existed goes back only if nobody changed it since.
    const current = (id: string) =>
      entry.bases[id] === undefined || sameTime(entry.bases[id], versions[list]?.[id]);
    for (const item of entry.put ?? []) {
      if (!item || typeof item.id !== 'string') continue;
      if (!current(item.id)) skipped += 1;
      else {
        result = putItem(result, list, item);
        applied += 1;
      }
    }
    for (const id of entry.drop ?? []) {
      // Already gone: nothing to do.
      if (!listOf(result, list)?.some((item) => item.id === id)) continue;
      if (!current(id)) skipped += 1;
      else {
        result = dropItem(result, list, id);
        applied += 1;
      }
    }
  }
  return { data: result, applied, skipped };
}
