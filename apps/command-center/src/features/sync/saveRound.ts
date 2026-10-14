import { useMarketStore } from '@/features/investments/state/marketStore';
import {
  loadCloudData,
  saveChanges,
  type CloudData,
  type LedgerChanges,
} from '@/lib/data/ledgerRepository';
import { RpcError } from '@/lib/data/rpc';
import type { Conflict, ListKey, SaveResult } from '@/lib/data/saveResult';
import { fromOps, toOps, withBases } from './batches';
import { addsHoldings } from './holdings';
import { idsOf, listOf, takeChanged, takeRows } from './lists';
import { CONFLICT_NOTICE, describeRefused } from './messages';
import { sendChanges, wasStopped, type Refusal } from './send';
import { applyToStores, snapshot } from './stores';
import { sync } from './syncState';
import { useSyncStatus } from './syncStatus';

const MAX_BACKOFF_MS = 30_000;
const status = () => useSyncStatus.getState();
const key = (list: ListKey, id: string) => `${list}:${id}`;

/** A part the database accepted: it becomes part of the saved copy. */
function confirm(next: CloudData, part: LedgerChanges, result: SaveResult) {
  if (!sync.baseline) return;
  const skipped = new Set(result.conflicts.map((c) => key(c.list, c.id)));
  const accepted = fromOps(toOps(part).filter((op) => !skipped.has(key(op.list, op.id))));
  sync.baseline = takeChanged(sync.baseline, next, accepted);
  for (const [list, ids] of Object.entries(idsOf(accepted)) as [ListKey, string[]][]) {
    const versions = { ...sync.versions[list] };
    const saved = new Set(((accepted[list] ?? []) as { id: string }[]).map((row) => row.id));
    for (const id of ids) {
      // Without migration 0020 the new version is unknown: the row goes unchecked next time.
      if (saved.has(id) && result.savedAt) versions[id] = result.savedAt;
      else delete versions[id];
      sync.unconfirmed[list]?.delete(id);
    }
    sync.versions = { ...sync.versions, [list]: versions };
  }
}

/** Puts back the saved version of each refused row, and says what was not saved. */
function undoRefused(next: CloudData, refused: Refusal[]) {
  if (!sync.baseline) return;
  let current = snapshot();
  for (const item of refused) {
    current = takeRows(current, sync.baseline, item.list, [item.id]);
    sync.unconfirmed[item.list]?.delete(item.id);
  }
  applyToStores(current);
  const labelOf = (list: ListKey, id: string) => {
    const item = listOf(next, list)?.find((row) => row.id === id) as
      { name?: unknown; title?: unknown } | undefined;
    const label = item?.name ?? item?.title;
    return typeof label === 'string' && label.trim() ? label.trim() : null;
  };
  status().notify('warning', describeRefused(refused, labelOf));
}

/** Rows changed or deleted on another device: shows the database's version of each. */
async function takeNewer(run: number, conflicts: Conflict[]): Promise<boolean> {
  let loaded: CloudData;
  try {
    loaded = await loadCloudData();
  } catch {
    return false;
  }
  if (run !== sync.generation || !sync.baseline) return true;
  const { versions = {}, ...server } = loaded;
  let current = snapshot();
  for (const { list, id } of conflicts) {
    sync.baseline = takeRows(sync.baseline, server, list, [id]);
    current = takeRows(current, server, list, [id]);
    const known = { ...sync.versions[list] };
    if (versions[list]?.[id]) known[id] = versions[list][id];
    else delete known[id];
    sync.versions = { ...sync.versions, [list]: known };
  }
  applyToStores(current);
  status().notify('info', CONFLICT_NOTICE);
  return true;
}

/** One save: sends `changes` (taken from `next`) and settles every outcome. */
export async function saveRound(
  run: number,
  next: CloudData,
  changes: LedgerChanges,
  keepalive: boolean,
  schedule: (delay: number) => void,
): Promise<void> {
  const before = sync.baseline;
  const outcome = await sendChanges(withBases(changes, sync.versions), {
    save: (part) => saveChanges(part, { keepalive }),
    confirmed: (part, result) => {
      if (run !== sync.generation) return false;
      confirm(next, part, result);
      return true;
    },
  });
  if (run !== sync.generation || wasStopped(outcome.error)) return;
  const { error, refused, conflicts } = outcome;
  if (refused.length) undoRefused(next, refused);
  const settled = conflicts.length ? await takeNewer(run, conflicts) : true;
  if (run !== sync.generation) return;
  if (error || !settled) {
    // New rows of a save that got no answer may be in the database already.
    const refusedIds = new Set(refused.map((item) => key(item.list, item.id)));
    for (const op of error ? toOps(changes) : []) {
      const known = sync.baseline && listOf(sync.baseline, op.list)?.some((r) => r.id === op.id);
      if (op.row && !known && !refusedIds.has(key(op.list, op.id))) {
        (sync.unconfirmed[op.list] ??= new Set()).add(op.id);
      }
    }
    sync.attempt += 1;
    status().set(error instanceof RpcError && error.status === 401 ? 'expired' : 'retrying');
    schedule(Math.min(MAX_BACKOFF_MS, 1000 * 2 ** sync.attempt));
    return;
  }
  sync.attempt = 0;
  status().set('saved');
  if (before && sync.baseline && addsHoldings(before.portfolio, sync.baseline.portfolio)) {
    void useMarketStore.getState().load();
  }
}
