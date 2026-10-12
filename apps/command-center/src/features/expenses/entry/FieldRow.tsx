import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useTheme } from '@/theme';

type FieldRowProps = {
  label: string;
  active: boolean;
  error?: string;
  /** Opens this field's picker. Omit for rows that hold an input. */
  onPress?: () => void;
  /** Name and value read by screen readers for pressable rows. */
  accessibilityLabel?: string;
  children: ReactNode;
};

const LABEL_WIDTH = 68;

/** One line of the entry form: label on the left, value on the right (Money Manager style). */
export function FieldRow({
  label,
  active,
  error,
  onPress,
  accessibilityLabel,
  children,
}: FieldRowProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  const line = error ? theme.colors.danger : active ? theme.colors.accent : theme.colors.border;
  const row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: 42,
        paddingHorizontal: theme.space[2],
        borderBottomWidth: 1.5,
        borderBottomColor: line,
        borderTopLeftRadius: theme.radius.sm,
        borderTopRightRadius: theme.radius.sm,
        backgroundColor: active || hovered ? theme.colors.surfaceMuted : 'transparent',
      }}
    >
      <Text
        variant="label"
        color={active ? 'accent' : 'textSecondary'}
        style={{ width: LABEL_WIDTH }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
  return (
    <View>
      {onPress ? (
        <Pressable
          role="button"
          accessibilityLabel={accessibilityLabel ?? label}
          aria-expanded={active}
          onPress={onPress}
          {...handlers}
          style={[
            { borderRadius: theme.radius.sm },
            focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
          ]}
        >
          {row}
        </Pressable>
      ) : (
        row
      )}
      {error ? (
        <Text
          variant="caption"
          color="danger"
          role="alert"
          style={{ marginTop: 4, marginLeft: LABEL_WIDTH + theme.space[5] }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
