import { RpcError } from '@/lib/data/rpc';

export type LoadProblem = 'offline' | 'server' | 'other';

/** Why loading failed, from what the browser knows and the failed request's status. */
export function loadProblem(online: boolean, failure: RpcError | null): LoadProblem {
  if (!online) return 'offline';
  if (!failure) return 'other';
  // A paused or overloaded project answers 5xx (or 408/429), or does not answer in time;
  // when online, an unreachable server looks like a network error to the browser.
  if (failure.status >= 500 || failure.status === 408 || failure.status === 429) return 'server';
  if (failure.status === 0 && (failure.code === 'timeout' || failure.code === 'network')) {
    return 'server';
  }
  return 'other';
}

export const LOAD_MESSAGES: Record<LoadProblem, string> = {
  offline: "You're offline. Your data loads when you're back online.",
  server: "The server isn't responding. Try again in a minute.",
  other: 'Your data could not be loaded. Try again.',
};

/** False only when the browser knows it has no connection (always true on phones). */
export const isOnline = () =>
  typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' || navigator.onLine;
