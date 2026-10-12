import { Pressable } from 'react-native';
import { Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { minHitSize, useTheme } from '@/theme';

type PickChipProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  /** Spoken name when it differs from the label (e.g. "All of Food"). */
  accessibilityLabel?: string;
};

/** Small choice button (subcategories, quick dates, note suggestions). */
export function PickChip({ label, onPress, selected = false, accessibilityLabel }: PickChipProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={(minHitSize - 30) / 2}
      {...handlers}
      style={[
        {
          height: 30,
          justifyContent: 'center',
          paddingHorizontal: theme.space[3],
          borderRadius: theme.radius.pill,
          backgroundColor: selected
            ? theme.colors.ink
            : hovered
              ? theme.colors.border
              : theme.colors.surface,
          borderWidth: 1,
          borderColor: selected ? theme.colors.ink : theme.colors.border,
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <Text variant="label" color={selected ? 'onInk' : 'textPrimary'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
