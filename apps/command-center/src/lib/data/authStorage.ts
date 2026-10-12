import * as SecureStore from 'expo-secure-store';

/**
 * Native session storage for Supabase Auth in the device's encrypted keystore
 * (Keychain / Keystore). SecureStore warns above ~2 KB per value and a session is
 * larger, so values are split into chunks under `key.0`, `key.1`, … with the count
 * stored under `key`.
 */
const CHUNK = 1800;

/** The keystore keeps the session on this device; there is no tab-only mode on native. */
export const canChooseKeepSignedIn = false;
export const isKeptSignedIn = () => true;
export const setKeptSignedIn = (keep: boolean): void => void keep;

const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function clearChunks(base: string) {
  const count = Number(await SecureStore.getItemAsync(base));
  if (!Number.isInteger(count) || count <= 0) return;
  await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(`${base}.${index}`)),
  );
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(base));
    if (!Number.isInteger(count) || count <= 0) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${base}.${index}`)),
    );
    return parts.every((part) => part !== null) ? parts.join('') : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const base = safeKey(key);
    await clearChunks(base);
    const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [''];
    await Promise.all(
      parts.map((part, index) => SecureStore.setItemAsync(`${base}.${index}`, part)),
    );
    await SecureStore.setItemAsync(base, String(parts.length));
  },
  async removeItem(key: string): Promise<void> {
    const base = safeKey(key);
    await clearChunks(base);
    await SecureStore.deleteItemAsync(base);
  },
};
