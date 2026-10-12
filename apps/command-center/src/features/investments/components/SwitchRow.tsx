import { Switch, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** A switch with its label and an optional explanation. */
export function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {hint ? (
          <Text variant="caption" color="textTertiary">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
        thumbColor={theme.colors.surface}
      />
    </View>
  );
}
