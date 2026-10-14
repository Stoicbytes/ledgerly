/**
 * Unsaved changes kept in this browser (localStorage) until they reach the database, so
 * closing the tab, a lost session or an idle sign-out does not lose them. One entry per
 * user id; it is removed once everything is saved. Too large an entry is not kept (the
 * page still asks before closing). Storage can be blocked: then nothing is kept.
 */
const PREFIX = 'ledgerly:unsaved:';
export const MAX_PENDING_CHARS = 2_000_000;

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function writePending(userId: string, value: string): boolean {
  try {
    if (value.length > MAX_PENDING_CHARS) {
      storage()?.removeItem(PREFIX + userId);
      return false;
    }
    storage()?.setItem(PREFIX + userId, value);
    return true;
  } catch {
    return false;
  }
}

export function readPending(userId: string): string | null {
  try {
    return storage()?.getItem(PREFIX + userId) ?? null;
  } catch {
    return null;
  }
}

export function clearPending(userId: string): void {
  try {
    storage()?.removeItem(PREFIX + userId);
  } catch {
    // Nothing kept.
  }
}
