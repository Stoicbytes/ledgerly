import { Download, Pencil, Plus, Trash2 } from '@/components/icons';
import { useState } from 'react';
import { View } from 'react-native';
import { Section } from '@/components/layout/Section';
import { Button, Card, Chip, IconButton, SegmentedControl } from '@/components/ui';
import { useTheme } from '@/theme';

type EntryType = 'income' | 'expense' | 'transfer';

export function ActionsSection() {
  const theme = useTheme();
  const [type, setType] = useState<EntryType>('expense');
  const [chips, setChips] = useState<string[]>(['This month']);
  const toggle = (label: string) =>
    setChips((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  return (
    <Section
      title="Actions"
      description="Every control has a 44pt hit area, hover and visible focus."
    >
      <Card>
        <View style={{ gap: theme.space[5] }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.space[2],
            }}
          >
            <Button label="Primary" icon={Plus} />
            <Button label="Secondary" variant="secondary" icon={Download} />
            <Button label="Ghost" variant="ghost" />
            <Button label="Delete" variant="danger" icon={Trash2} />
            <Button label="Saving" loading />
            <Button label="Disabled" disabled />
            <Button label="Small" size="sm" variant="secondary" />
            <Button label="Large" size="lg" />
          </View>
          <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
            <IconButton icon={Pencil} accessibilityLabel="Edit" />
            <IconButton icon={Plus} accessibilityLabel="Add" tone="accent" />
            <IconButton icon={Trash2} accessibilityLabel="Delete" tone="danger" />
            <IconButton icon={Pencil} accessibilityLabel="Edit (selected)" selected />
          </View>
          <SegmentedControl
            accessibilityLabel="Transaction type"
            value={type}
            onChange={setType}
            segments={[
              { value: 'income', label: 'Income', tone: 'income' },
              { value: 'expense', label: 'Expense', tone: 'expense' },
              { value: 'transfer', label: 'Transfer', tone: 'transfer' },
            ]}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
            {['This month', 'Food', 'Credit cards', 'Recurring'].map((label) => (
              <Chip
                key={label}
                label={label}
                selected={chips.includes(label)}
                onPress={() => toggle(label)}
              />
            ))}
          </View>
        </View>
      </Card>
    </Section>
  );
}
