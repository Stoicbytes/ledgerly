import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

/** True when the visitor has not asked for reduced motion (always false on the server). */
export const motionAllowed = () =>
  typeof document !== 'undefined' && document.documentElement.dataset.motion !== 'off';

/** Switches the page from "pending" to "ready" once the app runs (see motion.css). */
export function useMotionReady() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.motion === 'pending') root.dataset.motion = 'ready';
  }, []);
}

let observer: IntersectionObserver | null = null;
function revealObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  return observer;
}

/** Ref for an element that should reveal when it scrolls into view. */
export function useReveal<T extends Element>(): RefCallback<T> {
  return useCallback((node: T | null) => {
    if (!node) return;
    const io = revealObserver();
    if (!io || !motionAllowed()) node.classList.add('is-in');
    else io.observe(node);
  }, []);
}

/** Moves a soft highlight with the pointer (fine pointers only). */
export function usePointerGlow<T extends HTMLElement>(): RefCallback<T> {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((node: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!node || !window.matchMedia?.('(pointer: fine)').matches) return;
    const move = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      node.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      node.style.setProperty('--my', `${event.clientY - rect.top}px`);
    };
    node.addEventListener('pointermove', move);
    cleanup.current = () => node.removeEventListener('pointermove', move);
  }, []);
}

/** The current time, refreshed every 30 s; null until the browser runs (so SSR matches). */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return now;
}
