import * as SecureStore from 'expo-secure-store';
import { authStorage } from '../authStorage';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
  };
});

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

describe('native authStorage', () => {
  beforeEach(() => store.clear());

  it('splits a large session into chunks and joins it back', async () => {
    const session = 'x'.repeat(4000);
    await authStorage.setItem('sb-abc-auth-token', session);
    expect(store.get('sb-abc-auth-token')).toBe('3');
    expect([...store.values()].every((value) => value.length <= 1800)).toBe(true);
    expect(await authStorage.getItem('sb-abc-auth-token')).toBe(session);
  });

  it('drops old chunks when a shorter session replaces a longer one', async () => {
    await authStorage.setItem('key', 'a'.repeat(4000));
    await authStorage.setItem('key', 'short');
    expect(await authStorage.getItem('key')).toBe('short');
    expect(store.has('key.1')).toBe(false);
  });

  it('removes every chunk on sign-out', async () => {
    await authStorage.setItem('key', 'b'.repeat(2000));
    await authStorage.removeItem('key');
    expect(store.size).toBe(0);
    expect(await authStorage.getItem('key')).toBeNull();
  });
});
