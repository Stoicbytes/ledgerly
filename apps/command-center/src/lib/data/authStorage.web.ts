/**
 * Web session storage for Supabase Auth. By default the tab's sessionStorage, so the
 * refreshable session ends with the tab. On a device the owner
 * marks as their own ("Keep me signed in"), localStorage instead, so it survives
 * closing the browser; two-step sign-in still guards every new device. Neither
 * replaces Row Level Security. Storage can be unavailable (private windows, blocked
 * site data), in which case the user simply signs in again.
 */
const KEEP_KEY = 'cc.keepSignedIn';
const SESSION_PREFIX = 'sb-';

/** Web lets the owner choose; native apps always keep the session in the keystore. */
export const canChooseKeepSignedIn = true;

function stores(): { session: Storage | null; local: Storage | null } {
  const get = (name: 'sessionStorage' | 'localStorage') => {
    try {
      return window[name];
    } catch {
      return null;
    }
  };
  return { session: get('sessionStorage'), local: get('localStorage') };
}

export function isKeptSignedIn(): boolean {
  try {
    return stores().local?.getItem(KEEP_KEY) === '1';
  } catch {
    return false;
  }
}

/** Switches where the session lives, moving a current session along with the choice. */
export function setKeptSignedIn(keep: boolean): void {
  const { session, local } = stores();
  if (!session || !local) return;
  try {
    if (keep) local.setItem(KEEP_KEY, '1');
    else local.removeItem(KEEP_KEY);
    const [from, to] = keep ? [session, local] : [local, session];
    const keys = Array.from({ length: from.length }, (_, index) => from.key(index)).filter(
      (key): key is string => !!key && key.startsWith(SESSION_PREFIX),
    );
    for (const key of keys) {
      const value = from.getItem(key);
      if (value !== null) to.setItem(key, value);
      from.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing to move.
  }
}

export const authStorage = {
  getItem(key: string): string | null {
    const { session, local } = stores();
    try {
      return session?.getItem(key) ?? local?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    const { session, local } = stores();
    const keep = isKeptSignedIn();
    try {
      (keep ? local : session)?.setItem(key, value);
      (keep ? session : local)?.removeItem(key);
    } catch {
      // Storage blocked: the session lives in memory for this page only.
    }
  },
  removeItem(key: string): void {
    const { session, local } = stores();
    try {
      session?.removeItem(key);
      local?.removeItem(key);
    } catch {
      // Nothing stored.
    }
  },
};
