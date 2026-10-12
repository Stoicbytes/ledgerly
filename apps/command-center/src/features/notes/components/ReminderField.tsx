import { View } from 'react-native';
import { Button } from '@/components/ui';
import { DateField } from '@/features/investments/components/DateField';
import { useTheme } from '@/theme';

/**
 * "Remind me on" for a note: a date it comes back on (on Notes and Overview). There are no
 * push notifications; the app shows due notes when you open it.
 */
export function ReminderField({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string | null) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space[2] }}>
      <View style={{ flex: 1 }}>
        <DateField
          label="Remind me on"
          value={value}
          onChange={onChange}
          hint="Shown on Notes and Overview from that day."
        />
      </View>
      <Button label="Clear" variant="ghost" size="sm" onPress={() => onChange(null)} />
    </View>
  );
}
