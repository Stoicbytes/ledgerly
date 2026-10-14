/**
 * Phones: unsaved changes stay in memory only (the app keeps running in the background;
 * the web build keeps them in localStorage, see pendingStore.web.ts).
 */
export const writePending = (_userId: string, _value: string): boolean => false;
export const readPending = (_userId: string): string | null => null;
export const clearPending = (_userId: string): void => undefined;
