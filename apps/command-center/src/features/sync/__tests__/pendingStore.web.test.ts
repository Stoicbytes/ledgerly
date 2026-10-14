import { clearPending, MAX_PENDING_CHARS, readPending, writePending } from '../pendingStore.web';

const map = new Map<string, string>();
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => map.set(key, value),
      removeItem: (key: string) => map.delete(key),
    },
  },
  configurable: true,
});

beforeEach(() => map.clear());

describe('unsaved changes in the browser', () => {
  it('keeps one entry per user and clears it', () => {
    expect(writePending('u1', '{"a":1}')).toBe(true);
    expect(readPending('u1')).toBe('{"a":1}');
    expect(readPending('u2')).toBeNull();
    clearPending('u1');
    expect(readPending('u1')).toBeNull();
  });

  it('does not keep an entry that is too large (and drops an older one)', () => {
    writePending('u1', 'small');
    expect(writePending('u1', 'x'.repeat(MAX_PENDING_CHARS + 1))).toBe(false);
    expect(readPending('u1')).toBeNull();
  });
});
