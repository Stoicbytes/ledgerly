import { View } from 'react-native';
import { Text } from '@/components/ui';
import { PickChip } from '@/features/expenses/entry/PickChip';
import { useTheme } from '@/theme';

/** A labelled row of choice chips (exchange, sector, fund type). */
export function ChipField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[] | readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  const items = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        {items.map((item) => (
          <PickChip
            key={item.value}
            label={item.label}
            selected={item.value === value}
            onPress={() => onChange(item.value)}
          />
        ))}
      </View>
    </View>
  );
}
