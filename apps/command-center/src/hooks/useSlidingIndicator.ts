import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type LayoutRectangle } from 'react-native';
import { useMotion } from '@/theme';

/**
 * Position and width for a selection indicator (segmented control thumb, nav
 * pill) that glides to the selected item's layout. The first placement is
 * instant, so nothing slides in from the edge on load. Width cannot use the
 * native driver, so both values run on the JS driver.
 */
export function useSlidingIndicator(
  target: LayoutRectangle | undefined,
  kind: 'timing' | 'spring' = 'timing',
) {
  const { reduceMotion, duration, spring } = useMotion();
  const [x] = useState(() => new Animated.Value(0));
  const [width] = useState(() => new Animated.Value(0));
  const placed = useRef(false);
  const ms = duration('base');
  const left = target?.x;
  const size = target?.width;
  useEffect(() => {
    if (left === undefined || size === undefined) return;
    if (!placed.current || reduceMotion) {
      placed.current = true;
      x.setValue(left);
      width.setValue(size);
      return;
    }
    const move = (value: Animated.Value, toValue: number) =>
      kind === 'spring'
        ? Animated.spring(value, { toValue, ...spring, useNativeDriver: false })
        : Animated.timing(value, {
            toValue,
            duration: ms,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          });
    const animation = Animated.parallel([move(x, left), move(width, size)]);
    animation.start();
    return () => animation.stop();
  }, [left, size, kind, ms, reduceMotion, spring, x, width]);
  return { x, width, visible: left !== undefined };
}
