import { Chip, ScrollRow } from '@/components/ui';
import type { RecurringFrequency } from '@/lib/domain/expenses';
import { useRecurringStore } from '../state/recurringStore';
import { useTransactionForm } from '../state/transactionForm';
import { FieldRow } from './FieldRow';

const CHOICES: { value: RecurringFrequency | null; label: string }[] = [
  { value: null, label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * "Repeat" for a new entry: rent, a subscription, an EMI. Each later date then waits on
 * the Transactions page to be added or skipped. Not offered for edits, repayments or
 * split expenses.
 */
export function RepeatField() {
  const available = useRecurringStore((state) => state.available);
  const editing = useTransactionForm((state) => !!state.editingId);
  const draft = useTransactionForm((state) => state.draft);
  const update = useTransactionForm((state) => state.update);
  if (!available || editing || draft.fromRule || draft.personId || draft.splits.length) return null;
  const value = draft.repeat ?? null;
  return (
    <FieldRow label="Repeat" active={false}>
      <ScrollRow accessibilityLabel="Repeat">
        {CHOICES.map((choice) => (
          <Chip
            key={choice.label}
            label={choice.label}
            selected={value === choice.value}
            onPress={() => update({ repeat: choice.value })}
          />
        ))}
      </ScrollRow>
    </FieldRow>
  );
}
