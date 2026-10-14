import { Platform, View } from 'react-native';
import { minHitSize } from '@/theme';

/**
 * Grows a small control's touch area to 44 × 44 on the web, where React Native Web
 * ignores `hitSlop`: an invisible box around the control, inside its Pressable (so a tap
 * on it presses the control) and outside the layout (nothing moves).
 */
export function HitArea({ height, width }: { height: number; width?: number }) {
  if (Platform.OS !== 'web') return null;
  const y = Math.max(0, (minHitSize - height) / 2);
  const x = width === undefined ? 0 : Math.max(0, (minHitSize - width) / 2);
  if (!x && !y) return null;
  return (
    <View aria-hidden style={{ position: 'absolute', top: -y, bottom: -y, left: -x, right: -x }} />
  );
}
