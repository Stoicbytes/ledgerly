import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { duration, spring, type DurationToken } from './tokens';

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

// One app-wide subscription to the OS "reduce motion" setting. On web the
// media query answers synchronously, so the first frame already respects it.
let reduced =
  Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCE_QUERY).matches
    : false;
let listening = false;
const listeners = new Set<() => void>();

function update(value: boolean) {
  if (value === reduced) return;
  reduced = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!listening) {
    listening = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => undefined);
    AccessibilityInfo.addEventListener('reduceMotionChanged', update);
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Whether the person asked the OS (or browser) to reduce motion. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => reduced,
    () => false,
  );
}

/**
 * The only way components should obtain animation timings. When the OS asks
 * for reduced motion every non-essential duration collapses to 0.
 */
export function useMotion() {
  const reduceMotion = useReducedMotion();
  return {
    reduceMotion,
    duration: (token: DurationToken) => (reduceMotion ? 0 : duration[token]),
    spring,
  };
}

/** The native driver moves opacity/transform off the JS thread; web has none. */
export const useNativeDriver = Platform.OS !== 'web';
