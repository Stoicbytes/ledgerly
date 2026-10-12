import { useEffect, useState } from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';
import { useMotion, useNativeDriver } from '@/theme';

type AppearProps = ViewProps & {
  /** Start this many points lower and rise into place (0 = fade only). */
  rise?: number;
  duration?: number;
  delay?: number;
  /** Render in place without animating. */
  disabled?: boolean;
};

/**
 * Entrance animation: fades (and optionally rises) its content in once, when
 * it mounts. Built on React Native's Animated, which react-native-web ships,
 * so it adds nothing to the bundle. Instant when reduced motion is on.
 */
export function Appear({
  rise = 0,
  duration = 300,
  delay = 0,
  disabled = false,
  style,
  children,
  ...rest
}: AppearProps) {
  const { reduceMotion } = useMotion();
  const still = disabled || reduceMotion;
  const [progress] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, still, duration, delay]);
  const motion = {
    opacity: progress,
    transform: rise
      ? [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }]
      : [],
  };
  return (
    <Animated.View {...rest} style={[style, motion]}>
      {children}
    </Animated.View>
  );
}
