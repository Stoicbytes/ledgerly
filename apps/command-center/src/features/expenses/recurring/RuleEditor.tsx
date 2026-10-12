import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, ScrollRow, Text } from '@/components/ui';
import {
  amountToInput,
  dayLabel,
  FREQUENCY_LABELS,
  MAX_NOTE_LENGTH,
  parseLimitedAmount,
  type RecurringEntry,
  type RecurringFrequency,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { TextField } from '../components/TextField';
import { DatePicker } from '../entry/DatePicker';
import type { RulePatch } from '../state/recurringActions';

const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as RecurringFrequency[];

/** Change a rule's amount, note, how often and next date, or delete it. */
export function RuleEditor({
  rule,
  onSave,
  onDelete,
}: {
  rule: RecurringEntry;
  onSave: (patch: RulePatch) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const [amountText, setAmountText] = useState(amountToInput(rule.amount));
  const [note, setNote] = useState(rule.note);
  const [frequency, setFrequency] = useState(rule.frequency);
  const [nextDate, setNextDate] = useState(rule.nextDate);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const amount = parseLimitedAmount(amountText);
    if (!amount) return setError('Enter an amount like 15,000.');
    if (note.trim().length > MAX_NOTE_LENGTH) return setError('The note is too long.');
    onSave({ amount, note: note.trim(), frequency, nextDate });
  };
  return (
    <View style={{ gap: theme.space[3], paddingVertical: theme.space[2] }}>
      <TextField
        label="Amount"
        money
        value={amountText}
        onChangeText={(text) => {
          setAmountText(text);
          setError(null);
        }}
        error={error}
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
      <TextField label="Note" value={note} onChangeText={setNote} maxLength={MAX_NOTE_LENGTH} />
      <ScrollRow accessibilityLabel="How often">
        {FREQUENCIES.map((value) => (
          <Chip
            key={value}
            label={FREQUENCY_LABELS[value]}
            selected={frequency === value}
            onPress={() => setFrequency(value)}
          />
        ))}
      </ScrollRow>
      <Text variant="label">{`Next date · ${dayLabel(nextDate, 'short')}`}</Text>
      <DatePicker value={nextDate} onChoose={setNextDate} />
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        <Button label="Delete" variant="danger" size="sm" onPress={onDelete} />
        <View style={{ flex: 1 }} />
        <Button label="Save" size="sm" onPress={save} />
      </View>
    </View>
  );
}
