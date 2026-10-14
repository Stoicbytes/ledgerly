import { useSession } from '@/features/auth/sessionStore';
import { cleanUnusedReceipts } from '@/features/expenses/photos/receipts';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { buildChanges, loadCloudData, type CloudData } from '@/lib/data/ledgerRepository';
import { addsHoldings } from './holdings';
import { applyToStores, snapshot, subscribeToStores } from './stores';
import { watchLifecycle } from './lifecycle';
import { forgetPending, keepPending, replayPending } from './pending';
import { replayNotice, replaySkippedNotice } from './messages';
import { sync, withGhostDeletes } from './syncState';
import { saveRound } from './saveRound';
import { useSyncStatus } from './syncStatus';

/**
 * Keeps the in-memory stores and the user's cloud data in step. After sign-in it loads
 * everything (and puts back changes kept from this user's last visit), then watches the
 * stores: shortly after a change it sends the difference from the last saved copy
 * (`sync_ledger_v2`, in parts of at most 4,000 rows per list). Offline or server errors
 * are retried with back-off; rows the database refuses are found by splitting the batch
 * and only those are put back; rows changed or deleted on another device meanwhile are
 * not overwritten (the newer version is shown). Unsaved changes are kept on this device
 * until saved. Coming back to the app, focusing the window and every 5 minutes reload,
 * so changes made elsewhere show up. Screens call the same store actions as in preview.
 */
const DEBOUNCE_MS = 600;
/** Coming back sooner than this after the last load does not reload. */
export const REFRESH_AFTER_MS = 60_000;

const setStatus = (status: Parameters<ReturnType<typeof useSyncStatus.getState>['set']>[0]) =>
  useSyncStatus.getState().set(status);
const notify = (tone: 'info' | 'warning', message: string) =>
  useSyncStatus.getState().notify(tone, message);

function clearTimer() {
  if (sync.timer) clearTimeout(sync.timer);
  sync.timer = null;
}

function schedule(delay = DEBOUNCE_MS) {
  clearTimer();
  sync.timer = setTimeout(() => {
    sync.timer = null;
    void flush();
  }, delay);
}

/** Takes in freshly loaded data as the saved copy. */
function adopt(loaded: CloudData): CloudData {
  const { versions = {}, ...data } = loaded;
  sync.baseline = data;
  sync.versions = versions;
  sync.loadedAt = Date.now();
  return data;
}

/** Starts syncing for the signed-in user: replaces sample data with theirs. */
export async function startCloudSync(): Promise<void> {
  stopCloudSync();
  const run = ++sync.generation;
  // Never show sample data as if it were the user's, even for a moment.
  applyToStores({
    accounts: [],
    categories: [],
    people: [],
    transactions: [],
    notes: [],
    portfolio: EMPTY_PORTFOLIO,
  });
  useMarketStore.getState().enterCloud();
  setStatus('loading');
  let loaded: CloudData;
  try {
    loaded = await loadCloudData();
  } catch {
    if (run === sync.generation) setStatus('loadFailed');
    return;
  }
  if (run !== sync.generation) return;
  const data = adopt(loaded);
  sync.userId = useSession.getState().userId;
  // Changes this user left unsaved last time go back in, then out through the normal save.
  const replay = sync.userId
    ? replayPending(sync.userId, data, sync.versions)
    : { data, applied: 0, skipped: 0 };
  sync.replayed = replay.applied;
  if (replay.skipped) notify('warning', replaySkippedNotice(replay.skipped));
  applyToStores(replay.data);
  setStatus('saved');
  // Prices for the holdings load alongside (a failure only affects valuations).
  void useMarketStore.getState().load();
  // Tidying Storage is best-effort; a failure changes nothing the user sees.
  cleanUnusedReceipts(data.transactions).catch(() => undefined);
  sync.unsubscribers = [
    ...subscribeToStores(() => schedule()),
    // A change made just before the app is hidden is sent at once (phones often close
    // hidden tabs without warning); leaving the page with a change unsaved asks first.
    watchLifecycle({
      onHide: () => void flushCloudSync({ keepalive: true }),
      onReturn: () => void refreshCloudData(),
      hasUnsavedChanges,
    }),
  ];
  if (replay.applied) schedule(0);
  else if (sync.userId) forgetPending(sync.userId);
  // Notes deleted more than a week ago go for good (sent like any other change).
  useNotesStore.getState().purgeTrash();
}

/**
 * Back in the app: loads again so changes made on another device show up. Skipped when
 * the last load is under a minute old, and whenever an edit here is not saved yet (it is
 * sent first; the next return picks up the rest). An edit made while this loads wins.
 */
export async function refreshCloudData(): Promise<void> {
  const run = sync.generation;
  if (!sync.baseline || useSession.getState().status !== 'signedIn') return;
  if (Date.now() - sync.loadedAt < REFRESH_AFTER_MS || hasUnsavedChanges()) return;
  sync.loadedAt = Date.now();
  let loaded: CloudData;
  try {
    loaded = await loadCloudData();
  } catch {
    return; // Offline: keep what is on screen.
  }
  if (run !== sync.generation || !sync.baseline || hasUnsavedChanges()) return;
  const previous = sync.baseline;
  const data = adopt(loaded);
  if (!buildChanges(previous, data)) return;
  applyToStores(data);
  if (addsHoldings(previous.portfolio, data.portfolio)) void useMarketStore.getState().load();
}

/**
 * Loads everything again after the database itself changed the data (a reset in
 * Settings), so the screens and the saved copy match it and nothing is sent back.
 */
export async function reloadCloudData(): Promise<void> {
  const run = sync.generation;
  if (!sync.baseline) return;
  const loaded = await loadCloudData();
  if (run !== sync.generation) return;
  applyToStores(adopt(loaded));
}

/** Whether something the user changed has not reached the database yet. */
export function hasUnsavedChanges(): boolean {
  if (!sync.baseline) return false;
  return Boolean(sync.timer || sync.inFlight || withGhostDeletes(snapshot()));
}

/**
 * Stops watching the stores. Must run before the stores are cleared on sign-out, so the
 * clearing is never mistaken for the user deleting everything. Changes not saved yet
 * are kept on this device for the same user's next sign-in, unless `keep` is false.
 */
export function stopCloudSync(keep = true): void {
  if (sync.baseline && sync.userId) {
    const next = snapshot();
    const changes = withGhostDeletes(next);
    if (keep && changes) keepPending(sync.userId, next, changes, sync.versions);
    else forgetPending(sync.userId);
  }
  sync.generation += 1;
  sync.unsubscribers.forEach((unsubscribe) => unsubscribe());
  sync.unsubscribers = [];
  clearTimer();
  sync.baseline = null;
  sync.versions = {};
  sync.unconfirmed = {};
  sync.pending = false;
  sync.attempt = 0;
  sync.inFlight = null;
  sync.replayed = 0;
  sync.userId = null;
  setStatus('off');
}

/** Signing out on purpose with changes unsaved: they are dropped, here and on this device. */
export const discardUnsavedChanges = () => stopCloudSync(false);

/**
 * Sends any waiting changes now (before signing out, for example). True when everything
 * is saved; false when something still waits (offline, refused session), and is retried.
 */
export async function flushCloudSync(options: { keepalive?: boolean } = {}): Promise<boolean> {
  for (let round = 0; round < 3; round += 1) {
    clearTimer();
    await flush(options);
    while (sync.inFlight) await sync.inFlight;
    if (!hasUnsavedChanges()) return true;
    // The last try failed: its retry stays scheduled.
    if (sync.attempt > 0) break;
  }
  return false;
}

async function flush(options: { keepalive?: boolean } = {}): Promise<void> {
  if (sync.inFlight) {
    sync.pending = true;
    return sync.inFlight;
  }
  const run = sync.generation;
  // Only a signed-in user's own session may write (never while signing out).
  if (!sync.baseline || useSession.getState().status !== 'signedIn') return;
  const next = snapshot();
  const changes = withGhostDeletes(next);
  if (!changes) {
    setStatus('saved');
    if (sync.userId) forgetPending(sync.userId);
    return;
  }
  if (sync.userId) keepPending(sync.userId, next, changes, sync.versions);
  setStatus('saving');
  sync.inFlight = saveRound(run, next, changes, options.keepalive === true, schedule);
  try {
    await sync.inFlight;
  } finally {
    if (run === sync.generation) sync.inFlight = null;
  }
  if (run !== sync.generation) return;
  if (sync.pending) {
    sync.pending = false;
    void flush();
    return;
  }
  const left = withGhostDeletes(snapshot());
  if (sync.userId && !left && !sync.timer) {
    forgetPending(sync.userId);
    if (sync.replayed) notify('info', replayNotice(sync.replayed));
    sync.replayed = 0;
  } else if (sync.userId && left) keepPending(sync.userId, snapshot(), left, sync.versions);
}
