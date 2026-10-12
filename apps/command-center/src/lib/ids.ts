import * as Crypto from 'expo-crypto';

/** RFC 4122 v4 id. Uses Web Crypto where present (web, tests), expo-crypto on native. */
export function newId(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return webCrypto?.randomUUID ? webCrypto.randomUUID() : Crypto.randomUUID();
}
