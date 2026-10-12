import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui';
import { DateField } from '@/features/investments/components/DateField';
import { amountToInput, parseLimitedAmount, todayIso } from '@/lib/domain/expenses';
import { isValidInvestmentDate, type Goal } from '@/lib/domain/investments';
import { useTheme } from '@/theme';
import { TextField } from '../../expenses/components/TextField';
import type { GoalInput } from '@/features/investments/state/goalActions';

/** Name, target amount, target date and the yearly return to assume for a goal. */
export function GoalEditor({
  goal,
  onSave,
  onDelete,
  onCancel,
}: {
  goal: Goal | null;
  onSave: (input: GoalInput) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(goal?.name ?? '');
  const [amountText, setAmountText] = useState(goal ? amountToInput(goal.targetAmount) : '');
  const [date, setDate] = useState(
    goal?.targetDate ?? `${Number(todayIso().slice(0, 4)) + 5}-04-01`,
  );
  const [returnText, setReturnText] = useState(goal ? String(goal.expectedReturn) : '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = () => {
    const targetAmount = parseLimitedAmount(amountText);
    const expectedReturn = returnText.trim() ? Number(returnText.replace('%', '')) : 0;
    const next = {
      name:
        name.trim() && name.trim().length <= 60 ? undefined : 'Enter a name (up to 60 letters).',
      amount:
        targetAmount && targetAmount >= 100
          ? undefined
          : 'Enter the amount you need, like 50,00,000.',
      date:
        isValidInvestmentDate(date) && date > todayIso() ? undefined : 'Pick a date in the future.',
      ret:
        Number.isFinite(expectedReturn) && expectedReturn >= 0 && expectedReturn <= 30
          ? undefined
          : 'Enter a yearly return from 0 to 30 %.',
    };
    if (Object.values(next).some(Boolean) || !targetAmount) return setErrors(next);
    onSave({
      name: name.trim(),
      targetAmount,
      targetDate: date,
      expectedReturn: Math.round(expectedReturn * 100) / 100,
    });
  };
  return (
    <View style={{ gap: theme.space[3], paddingVertical: theme.space[2] }}>
      <TextField
        label="Goal"
        value={name}
        onChangeText={setName}
        maxLength={60}
        placeholder="e.g. Retirement, House"
        error={errors.name}
      />
      <TextField
        label="Amount needed"
        money
        value={amountText}
        onChangeText={setAmountText}
        inputMode="decimal"
        keyboardType="decimal-pad"
        error={errors.amount}
      />
      <DateField label="By" value={date} onChange={setDate} error={errors.date} />
      <TextField
        label="Yearly return to assume (%)"
        value={returnText}
        onChangeText={setReturnText}
        inputMode="decimal"
        keyboardType="decimal-pad"
        placeholder="e.g. 10"
        hint="Your own assumption, used only to estimate what you need to invest. Real returns vary."
        error={errors.ret}
      />
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        {onDelete ? <Button label="Delete" variant="danger" size="sm" onPress={onDelete} /> : null}
        <View style={{ flex: 1 }} />
        <Button label="Cancel" variant="ghost" size="sm" onPress={onCancel} />
        <Button label="Save" size="sm" onPress={save} />
      </View>
    </View>
  );
}
