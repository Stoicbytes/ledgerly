import { Platform } from 'react-native';
import { hasUnsavedChanges } from '@/features/sync/cloudSync';

const KEY = 'ledgerly:reloaded-for-update';
const WINDOW_MS = 60_000;

/**
 * Screens load as separate files on the web. After a new deploy, a tab left open still
 * asks for the old files, which no longer exist; reloading picks up the new version.
 */
export const isStaleBuildError = (error: Error) =>
  error.name === 'AsyncRequireError' ||
  /Loading chunk|dynamically imported module|Requiring unknown module/i.test(error.message);

/**
 * Reload once for a stale build, but never offline (the reload would fail too) or while
 * changes are still waiting to be saved; then the error screen offers Retry instead.
 */
export function reloadForUpdate(error: Error, now = Date.now()): boolean {
  if (Platform.OS !== 'web' || !isStaleBuildError(error)) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  // Any change not yet in the database (waiting to be sent, sending, or to be retried).
  if (hasUnsavedChanges()) return false;
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (now - last < WINDOW_MS) return false;
    window.sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
