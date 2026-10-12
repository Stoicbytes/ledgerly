import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

type TooltipBubbleProps = { label: string; placement?: 'right' | 'top' };

/**
 * Visual tooltip for hover/focus (web) and long-press (native). Purely
 * supplementary: the owning control already exposes the same text as its
 * accessibility label, so the bubble is hidden from assistive tech.
 */
export function TooltipBubble({ label, placement = 'right' }: TooltipBubbleProps) {
  const theme = useTheme();
  const position: ViewStyle =
    placement === 'right'
      ? { left: '100%', top: '50%', marginLeft: theme.space[2], transform: [{ translateY: -14 }] }
      : { bottom: '100%', left: 0, marginBottom: theme.space[2] };
  return (
    <View
      aria-hidden
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          zIndex: 50,
          backgroundColor: theme.colors.inverseSurface,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.space[2],
          paddingVertical: theme.space[1],
        },
        position,
      ]}
    >
      <Text variant="caption" color="onInverseSurface" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
