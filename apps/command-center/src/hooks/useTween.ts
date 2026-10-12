import { useEffect, useState } from 'react';
import { useMotion } from '@/theme';

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Animates a number 0 → 1 with requestAnimationFrame, restarting whenever
 * `key` changes. Used for chart draw-in and count-ups; works identically on
 * web and native and returns 1 straight away when reduced motion is on.
 */
export function useTween(key: unknown, durationMs = 700, delayMs = 0): number {
  const { reduceMotion } = useMotion();
  const [state, setState] = useState<{ key: unknown; progress: number }>({ key, progress: 0 });

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now + delayMs;
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      setState({ key, progress: easeOutCubic(t) });
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [key, durationMs, delayMs, reduceMotion]);

  if (reduceMotion) return 1;
  // A new key restarts from 0 immediately, before the first frame arrives.
  return Object.is(state.key, key) ? state.progress : 0;
}

/** Counts from the previous value to `value` (integers stay integers). */
export function useCountUp(value: number, durationMs = 800): number {
  const [range, setRange] = useState({ from: 0, to: value });
  if (range.to !== value) setRange({ from: range.to, to: value });
  const progress = useTween(value, durationMs);
  return Math.round(range.from + (range.to - range.from) * progress);
}
