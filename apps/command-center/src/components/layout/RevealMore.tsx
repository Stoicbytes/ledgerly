import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Button } from '../ui/Button';

/** Rows rendered at first, and added each time the end of the list comes near. */
export const REVEAL_STEP = 40;

const canObserve = () => Platform.OS === 'web' && typeof IntersectionObserver !== 'undefined';

/**
 * Long lists on the web render their first rows, then more as the reader scrolls towards
 * the end (the page itself scrolls, so a virtualised list cannot be used). `resetKey`
 * (e.g. the month) starts again from the top. Phones render everything.
 */
export function useReveal(total: number, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, shown: REVEAL_STEP });
  const shown = state.key === resetKey ? state.shown : REVEAL_STEP;
  if (state.key !== resetKey) setState({ key: resetKey, shown: REVEAL_STEP });
  const more = () => setState({ key: resetKey, shown: shown + REVEAL_STEP });
  const limit = canObserve() ? Math.min(total, shown) : total;
  return { limit, rest: total - limit, more };
}

/** Sits after the rendered rows: reveals more when it scrolls into view, or when pressed. */
export function RevealMore({ rest, onMore }: { rest: number; onMore: () => void }) {
  const ref = useRef<View>(null);
  const latest = useRef(onMore);
  useEffect(() => {
    latest.current = onMore;
  });
  useEffect(() => {
    const node = ref.current as unknown as Element | null;
    if (!rest || !node || !canObserve()) return undefined;
    // Re-created after every reveal, so a sentinel still in view asks for more again.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) latest.current();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rest]);
  if (!rest) return null;
  return (
    <View ref={ref} style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Button
        label={`Show ${Math.min(rest, REVEAL_STEP)} more`}
        variant="ghost"
        size="sm"
        accessibilityHint={`${rest} more ${rest === 1 ? 'entry' : 'entries'} in this list`}
        onPress={onMore}
      />
    </View>
  );
}
