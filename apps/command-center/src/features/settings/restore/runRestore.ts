import { flushCloudSync, hasUnsavedChanges, reloadCloudData } from '@/features/sync/cloudSync';
import { applyToStores, snapshot } from '@/features/sync/stores';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { loadCloudData } from '@/lib/data/ledgerRepository';
import { restoreBatches, saveRestoreBatches } from '@/lib/data/restoreBatches';
import { deleteSiteItem, loadSite, saveSiteItem } from '@/lib/data/siteRepository';
import {
  addedIds,
  itemsOf,
  planRestore,
  RESTORE_KINDS,
  siteItemCount,
  sitePayloads,
  withAdded,
  withoutRestored,
  type AddedIds,
  type Backup,
  type LedgerData,
  type RestorePlan,
} from '@/lib/domain/backup';
import { SITE_KINDS, type SiteData, type SiteKind } from '@/lib/domain/site';

/** What happened to the portfolio site's part of a backup. */
export type SiteOutcome =
  | { status: 'none' | 'notEmpty' | 'preview' | 'unreadable' }
  | { status: 'restored'; saved: { kind: string; id: string }[]; invalid: number; failed: number };

export type RestoreResult = {
  plan: RestorePlan;
  added: AddedIds;
  /** A batch was refused or the connection dropped: only part was added. */
  stopped: boolean;
  site: SiteOutcome;
};

const isEmptySite = (site: SiteData) => siteItemCount(site) === 0;

/** The data a backup is compared with: the database's copy when signed in. */
export const currentData = (cloud: boolean): Promise<LedgerData> =>
  cloud ? loadCloudData() : Promise.resolve(snapshot());

/** Whether the portfolio site is empty (restorable), not, or unknown. */
export async function siteState(cloud: boolean): Promise<'empty' | 'notEmpty' | 'unknown'> {
  if (!cloud) return 'unknown';
  try {
    return isEmptySite(await loadSite()) ? 'empty' : 'notEmpty';
  } catch {
    return 'unknown';
  }
}

const show = (data: LedgerData) =>
  applyToStores({ ...data, noteExtras: useNotesStore.getState().extras });

async function restoreSite(backup: Backup): Promise<SiteOutcome> {
  if (!backup.site || isEmptySite(backup.site)) return { status: 'none' };
  try {
    if (!isEmptySite(await loadSite())) return { status: 'notEmpty' };
  } catch {
    return { status: 'unreadable' };
  }
  const { items, invalid } = sitePayloads(backup.site);
  const saved: { kind: string; id: string }[] = [];
  let failed = 0;
  for (const item of items) {
    try {
      await saveSiteItem(item.kind, item.payload);
      saved.push({ kind: item.kind, id: item.id });
    } catch {
      failed += 1;
    }
  }
  return { status: 'restored', saved, invalid, failed };
}

/**
 * Restores a backup by adding what is missing. Signed in: waiting edits are sent first,
 * the plan is made against the database as it is now, the records go through the
 * normal save (`sync_ledger`) in batches, and everything is loaded again. Preview: the
 * records are added to the sample data on this screen only.
 */
export async function runRestore(
  backup: Backup,
  cloud: boolean,
  onProgress: (saved: number, total: number) => void,
): Promise<RestoreResult> {
  if (!cloud) {
    const current = snapshot();
    const plan = planRestore(backup, current);
    show(withAdded(current, plan.add));
    return { plan, added: addedIds(plan.add), stopped: false, site: { status: 'preview' } };
  }
  await flushCloudSync();
  if (hasUnsavedChanges()) {
    throw new Error(
      'Some changes are still waiting to be saved. Check your connection and try again.',
    );
  }
  const plan = planRestore(backup, await loadCloudData());
  const batches = restoreBatches(plan.add);
  let stopped = false;
  try {
    await saveRestoreBatches(batches, (saved) => onProgress(saved, batches.length));
  } catch {
    stopped = true;
  }
  const site = stopped ? ({ status: 'none' } as const) : await restoreSite(backup);
  await reloadCloudData().catch(() => undefined);
  return { plan, added: addedIds(plan.add), stopped, site };
}

/**
 * Takes a restore back: removes the records it added that are still here (anything used
 * since stays) through the normal save, and the portfolio items it added. The portfolio
 * profile stays (it cannot be deleted, only edited).
 */
export async function undoRestore(result: RestoreResult): Promise<number> {
  // Returns how many records were removed.
  const before = snapshot();
  const after = withoutRestored(before, result.added);
  show(after);
  const size = (data: LedgerData) =>
    RESTORE_KINDS.reduce((sum, kind) => sum + (itemsOf(data, kind)?.length ?? 0), 0);
  if (result.site.status === 'restored') {
    // Skills first: they belong to a group.
    const order = (kind: string) => (kind === 'skill' ? 0 : 1);
    const items = [...result.site.saved].sort((a, b) => order(a.kind) - order(b.kind));
    for (const item of items) {
      if (!(SITE_KINDS as readonly string[]).includes(item.kind)) continue;
      await deleteSiteItem(item.kind as SiteKind, item.id).catch(() => undefined);
    }
  }
  return size(before) - size(after);
}
