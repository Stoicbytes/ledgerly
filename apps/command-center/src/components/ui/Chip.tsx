import { Pressable } from 'react-native';
import { useInteractionState } from '@/hooks/useInteractionState';
import { minHitSize, useTheme } from '@/theme';
import { Text } from './Text';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

/** Toggleable filter chip. */
export function Chip({ label, selected = false, onPress, disabled }: ChipProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={(minHitSize - 28) / 2}
      {...handlers}
      style={[
        {
          height: 28,
          justifyContent: 'center',
          paddingHorizontal: theme.space[3],
          borderRadius: theme.radius.pill,
          backgroundColor: selected
            ? theme.colors.ink
            : hovered
              ? theme.colors.border
              : theme.colors.surfaceMuted,
          opacity: disabled ? 0.5 : 1,
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <Text variant="label" color={selected ? 'onInk' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}
