import { useEffect, useState } from 'react';
import { Animated, type DimensionValue } from 'react-native';
import { useMotion, useNativeDriver, useTheme } from '@/theme';

type SkeletonProps = { width?: DimensionValue; height?: number; radius?: number };

/**
 * Placeholder block. Decorative only: the loading region that contains it is
 * responsible for announcing "Loading …" to assistive tech.
 */
export function Skeleton({ width = '100%', height = 16, radius }: SkeletonProps) {
  const theme = useTheme();
  const { reduceMotion } = useMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const pulse = (toValue: number) =>
      Animated.timing(opacity, { toValue, duration: 900, useNativeDriver });
    const loop = Animated.loop(Animated.sequence([pulse(0.5), pulse(1)]));
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.surfaceMuted,
        },
        { opacity },
      ]}
    />
  );
}
