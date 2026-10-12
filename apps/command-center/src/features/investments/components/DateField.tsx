import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CalendarDays } from '@/components/icons';
import { Text } from '@/components/ui';
import { DatePicker } from '@/features/expenses/entry/DatePicker';
import { useInteractionState } from '@/hooks/useInteractionState';
import { dayLabel, isValidIsoDate } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';

/** Labelled date that opens the month grid in place (forms in sheets). */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
  error?: string;
  hint?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const { hovered, focused, handlers } = useInteractionState();
  const shown = isValidIsoDate(value) ? dayLabel(value) : 'Pick a date';
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Pressable
        role="button"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        {...handlers}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          minHeight: 44,
          paddingHorizontal: theme.space[3],
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor: error
            ? theme.colors.danger
            : focused || open
              ? theme.colors.accent
              : theme.colors.borderStrong,
          backgroundColor: hovered ? theme.colors.surfaceMuted : theme.colors.surface,
        }}
      >
        <CalendarDays size={16} color={theme.colors.textSecondary} />
        <Text variant="body">{shown}</Text>
      </Pressable>
      {open ? (
        <DatePicker
          value={isValidIsoDate(value) ? value : new Date().toISOString().slice(0, 10)}
          onChoose={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      ) : null}
      {error ? (
        <Text variant="caption" color="danger" role="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
