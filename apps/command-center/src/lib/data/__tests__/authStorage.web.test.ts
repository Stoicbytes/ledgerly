import { authStorage, isKeptSignedIn, setKeptSignedIn } from '../authStorage.web';

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const session = new MemoryStorage();
const local = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  value: { sessionStorage: session, localStorage: local },
  configurable: true,
});

beforeEach(() => {
  for (const store of [session, local]) {
    while (store.length) store.removeItem(store.key(0)!);
  }
});

describe('web authStorage', () => {
  it('keeps the session in this tab by default', () => {
    expect(isKeptSignedIn()).toBe(false);
    authStorage.setItem('sb-abc-auth-token', 'token');
    expect(session.getItem('sb-abc-auth-token')).toBe('token');
    expect(local.getItem('sb-abc-auth-token')).toBeNull();
  });

  it('keeps it on the device when chosen, moving a current session along', () => {
    authStorage.setItem('sb-abc-auth-token', 'token');
    session.setItem('other-app', 'untouched');
    setKeptSignedIn(true);
    expect(isKeptSignedIn()).toBe(true);
    expect(local.getItem('sb-abc-auth-token')).toBe('token');
    expect(session.getItem('sb-abc-auth-token')).toBeNull();
    expect(session.getItem('other-app')).toBe('untouched');
    authStorage.setItem('sb-abc-auth-token', 'refreshed');
    expect(local.getItem('sb-abc-auth-token')).toBe('refreshed');
    expect(authStorage.getItem('sb-abc-auth-token')).toBe('refreshed');
  });

  it('moves it back to the tab when unticked, and sign-out clears both', () => {
    setKeptSignedIn(true);
    authStorage.setItem('sb-abc-auth-token', 'token');
    setKeptSignedIn(false);
    expect(session.getItem('sb-abc-auth-token')).toBe('token');
    expect(local.getItem('sb-abc-auth-token')).toBeNull();
    local.setItem('sb-abc-auth-token', 'stale');
    authStorage.removeItem('sb-abc-auth-token');
    expect(authStorage.getItem('sb-abc-auth-token')).toBeNull();
  });

  it('keeps the reset link’s code verifier where a new tab can read it, then removes it', () => {
    const key = 'sb-abc-auth-token-code-verifier';
    authStorage.setItem(key, 'verifier');
    expect(local.getItem(key)).toBe('verifier');
    expect(session.getItem(key)).toBeNull();
    // The email link opens a new tab: empty sessionStorage, same localStorage.
    for (const k of [...Array(session.length).keys()].map((i) => session.key(i)!)) {
      session.removeItem(k);
    }
    expect(authStorage.getItem(key)).toBe('verifier');
    authStorage.removeItem(key);
    expect(authStorage.getItem(key)).toBeNull();
  });

  it('never moves the code verifier into the tab when keep-signed-in is unticked', () => {
    setKeptSignedIn(true);
    authStorage.setItem('sb-abc-auth-token-code-verifier', 'verifier');
    setKeptSignedIn(false);
    expect(local.getItem('sb-abc-auth-token-code-verifier')).toBe('verifier');
  });
});
