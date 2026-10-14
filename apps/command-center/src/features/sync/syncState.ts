import { buildChanges, type CloudData, type LedgerChanges } from '@/lib/data/ledgerRepository';
import type { ListKey, Versions } from '@/lib/data/saveResult';
import { hasItem } from './lists';

/** The cloud sync's working state, shared by cloudSync.ts and saveRound.ts. */
export const sync = {
  generation: 0,
  /** The data as last saved or loaded (what the database holds). */
  baseline: null as CloudData | null,
  /** `updated_at` of each saved row, sent back so the database can spot newer versions. */
  versions: {} as Versions,
  /**
   * New rows sent in a save that never answered (timeout, lost connection): the database
   * may have them. Deleted here before a retry, their ids are sent as deletions too.
   */
  unconfirmed: {} as Partial<Record<ListKey, Set<string>>>,
  unsubscribers: [] as (() => void)[],
  timer: null as ReturnType<typeof setTimeout> | null,
  inFlight: null as Promise<void> | null,
  pending: false,
  attempt: 0,
  loadedAt: 0,
  userId: null as string | null,
  /** Changes put back from the last visit, announced once they are saved. */
  replayed: 0,
};

/** The batch from the saved copy to `next`, plus deletions of unconfirmed rows gone since. */
export function withGhostDeletes(next: CloudData): LedgerChanges | null {
  if (!sync.baseline) return null;
  const changes = buildChanges(sync.baseline, next);
  const ghosts: Partial<Record<ListKey, string[]>> = {};
  for (const [list, ids] of Object.entries(sync.unconfirmed) as [ListKey, Set<string>][]) {
    const gone = [...ids].filter(
      (id) => !hasItem(next, list, id) && !hasItem(sync.baseline as CloudData, list, id),
    );
    if (gone.length) ghosts[list] = gone;
  }
  if (!Object.keys(ghosts).length) return changes;
  const result: LedgerChanges = changes ?? {};
  const deleted = { ...result.deleted };
  for (const [list, ids] of Object.entries(ghosts) as [ListKey, string[]][]) {
    deleted[list] = [...(deleted[list] ?? []), ...ids];
  }
  return { ...result, deleted };
}
