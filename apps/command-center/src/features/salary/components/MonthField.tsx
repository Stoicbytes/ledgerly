import { View } from 'react-native';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { IconButton, Text } from '@/components/ui';
import { addMonths, monthLabel } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';

/** A labelled ‹ April 2026 › month picker. */
export function MonthField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (month: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 44,
          paddingHorizontal: 4,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <IconButton
          icon={ChevronLeft}
          size="sm"
          accessibilityLabel="Previous month"
          onPress={() => onChange(addMonths(value, -1))}
        />
        <Text variant="bodyStrong" style={{ flex: 1, textAlign: 'center' }}>
          {monthLabel(value)}
        </Text>
        <IconButton
          icon={ChevronRight}
          size="sm"
          accessibilityLabel="Next month"
          onPress={() => onChange(addMonths(value, 1))}
        />
      </View>
    </View>
  );
}
