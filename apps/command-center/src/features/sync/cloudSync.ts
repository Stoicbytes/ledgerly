import { useSession } from '@/features/auth/sessionStore';
import { cleanUnusedReceipts } from '@/features/expenses/photos/receipts';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import {
  buildChanges,
  loadCloudData,
  saveChanges,
  type CloudData,
} from '@/lib/data/ledgerRepository';
import { RpcError } from '@/lib/data/rpc';
import { addsHoldings } from './holdings';
import { applyToStores, snapshot, subscribeToStores } from './stores';
import { watchLifecycle } from './lifecycle';
import { useSyncStatus } from './syncStatus';

/**
 * Keeps the in-memory stores and the user's cloud data in step. After sign-in it loads
 * everything, then watches the stores: shortly after a change it sends the difference
 * from the last saved copy as one atomic batch (`sync_ledger`). Offline or server
 * errors are retried with back-off; a change the database refuses is rolled back by
 * reloading. Coming back to the app reloads, so changes made on another device show up
 * (the last save of a row wins). Screens keep calling the same store actions as in
 * preview mode.
 */
const DEBOUNCE_MS = 600;
const MAX_BACKOFF_MS = 30_000;
/** Coming back sooner than this after the last load does not reload. */
export const REFRESH_AFTER_MS = 60_000;

let generation = 0;
let baseline: CloudData | null = null;
let unsubscribers: (() => void)[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let pending = false;
let attempt = 0;
let loadedAt = 0;

const setStatus = (status: Parameters<ReturnType<typeof useSyncStatus.getState>['set']>[0]) =>
  useSyncStatus.getState().set(status);

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function schedule(delay = DEBOUNCE_MS) {
  clearTimer();
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, delay);
}

/** Starts syncing for the signed-in user: replaces sample data with theirs. */
export async function startCloudSync(): Promise<void> {
  stopCloudSync();
  const run = ++generation;
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
  let data: CloudData;
  try {
    data = await loadCloudData();
  } catch {
    if (run === generation) setStatus('loadFailed');
    return;
  }
  if (run !== generation) return;
  baseline = data;
  loadedAt = Date.now();
  applyToStores(data);
  setStatus('saved');
  // Prices for the holdings load alongside (a failure only affects valuations).
  void useMarketStore.getState().load();
  // Tidying Storage is best-effort; a failure changes nothing the user sees.
  cleanUnusedReceipts(data.transactions).catch(() => undefined);
  unsubscribers = [
    ...subscribeToStores(() => schedule()),
    // A change made just before the app is hidden is sent at once (phones often close
    // hidden tabs without warning); leaving the page with a change unsaved asks first.
    watchLifecycle({
      onHide: () => void flushCloudSync(),
      onReturn: () => void refreshCloudData(),
      hasUnsavedChanges,
    }),
  ];
  // Notes deleted more than a week ago go for good (sent like any other change).
  useNotesStore.getState().purgeTrash();
}

/**
 * Back in the app: loads again so changes made on another device show up. Skipped when
 * the last load is under a minute old, and whenever an edit here is not saved yet (it is
 * sent first; the next return picks up the rest). An edit made while this loads wins.
 */
export async function refreshCloudData(): Promise<void> {
  const run = generation;
  if (!baseline || useSession.getState().status !== 'signedIn') return;
  if (Date.now() - loadedAt < REFRESH_AFTER_MS || hasUnsavedChanges()) return;
  loadedAt = Date.now();
  let data: CloudData;
  try {
    data = await loadCloudData();
  } catch {
    return; // Offline: keep what is on screen.
  }
  if (run !== generation || !baseline || hasUnsavedChanges()) return;
  if (!buildChanges(baseline, data)) return;
  const newHoldings = addsHoldings(baseline.portfolio, data.portfolio);
  baseline = data;
  applyToStores(data);
  if (newHoldings) void useMarketStore.getState().load();
}

/**
 * Loads everything again after the database itself changed the data (a reset in
 * Settings), so the screens and the saved copy match it and nothing is sent back.
 */
export async function reloadCloudData(): Promise<void> {
  const run = generation;
  if (!baseline) return;
  const data = await loadCloudData();
  if (run !== generation) return;
  baseline = data;
  loadedAt = Date.now();
  applyToStores(data);
}

/** Whether something the user changed has not reached the database yet. */
export function hasUnsavedChanges(): boolean {
  if (!baseline) return false;
  return Boolean(timer || inFlight || buildChanges(baseline, snapshot()));
}

/**
 * Stops watching the stores. Must run before the stores are cleared on sign-out, so the
 * clearing is never mistaken for the user deleting everything.
 */
export function stopCloudSync(): void {
  generation += 1;
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
  clearTimer();
  baseline = null;
  pending = false;
  attempt = 0;
  inFlight = null;
  setStatus('off');
}

/** Sends any waiting changes now (before signing out, for example). */
export async function flushCloudSync(): Promise<void> {
  clearTimer();
  await flush();
  if (inFlight) await inFlight;
}

async function flush(): Promise<void> {
  if (inFlight) {
    pending = true;
    return inFlight;
  }
  const run = generation;
  // Only a signed-in user's own session may write (never while signing out).
  if (!baseline || useSession.getState().status !== 'signedIn') return;
  const next = snapshot();
  const changes = buildChanges(baseline, next);
  if (!changes) {
    setStatus('saved');
    return;
  }
  setStatus('saving');
  inFlight = (async () => {
    try {
      await saveChanges(changes);
      if (run !== generation) return;
      const newHoldings = baseline ? addsHoldings(baseline.portfolio, next.portfolio) : false;
      baseline = next;
      attempt = 0;
      setStatus('saved');
      if (newHoldings) void useMarketStore.getState().load();
    } catch (error) {
      if (run !== generation) return;
      if (error instanceof RpcError && !error.retryable) {
        // The database refused the change: show the saved state again.
        await reload(run);
        return;
      }
      attempt += 1;
      setStatus('retrying');
      schedule(Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt));
    }
  })();
  try {
    await inFlight;
  } finally {
    if (run === generation) inFlight = null;
  }
  if (run === generation && pending) {
    pending = false;
    void flush();
  }
}

async function reload(run: number): Promise<void> {
  try {
    const data = await loadCloudData();
    if (run !== generation) return;
    baseline = data;
    loadedAt = Date.now();
    applyToStores(data);
    useSyncStatus.getState().setRejected(true);
    setStatus('saved');
  } catch {
    if (run === generation) setStatus('retrying');
  }
}
