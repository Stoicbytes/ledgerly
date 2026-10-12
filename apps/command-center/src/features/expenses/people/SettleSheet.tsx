import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import {
  amountToInput,
  parseAmount,
  type OpenSplit,
  type PersonBalance,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { TextField } from '../components/TextField';
import { AccountPicker } from '../entry/AccountPicker';
import { formatEntry } from '../format';
import { useExpenseStore } from '../state/expenseStore';
import { recordRepayment } from '../state/peopleActions';

type SettleSheetProps = {
  balance: PersonBalance;
  /** Paying for one shared expense; omit for a general payment. */
  target?: { split: OpenSplit; title: string } | null;
  visible: boolean;
  onClose: () => void;
};

/**
 * "Mark as paid": records the money a person paid back into the account it went
 * to. Their oldest shares are settled first; a part payment leaves the rest owed.
 */
export function SettleSheet({ balance, target, visible, onClose }: SettleSheetProps) {
  const theme = useTheme();
  const toast = useToast();
  const { person, outstanding } = balance;
  // For one expense, the most they can pay is what is left of that share.
  const limit = target ? target.split.remaining : outstanding;
  const [amountText, setAmountText] = useState(amountToInput(Math.max(0, limit)));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const amount = parseAmount(amountText);
    if (!amount || amount <= 0) return setError('Enter the amount they paid.');
    if (amount > limit) {
      return setError(
        target
          ? `${formatEntry(limit)} is left on this expense.`
          : `${person.name} owes ${formatEntry(limit)}.`,
      );
    }
    if (!accountId) return setError('Choose the account the money went to.');
    const repayment = recordRepayment({
      personId: person.id,
      amount,
      accountId,
      settles: target ? [target.split.transaction.id] : [],
    });
    onClose();
    toast.show({
      message: `${person.name} paid ${formatEntry(amount)}`,
      action: {
        label: 'Undo',
        onPress: () => useExpenseStore.getState().deleteTransaction(repayment.id),
      },
    });
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={target ? `${person.name} paid for ${target.title}` : `${person.name} paid you`}
      description={
        target
          ? `Their share was ${formatEntry(target.split.amount)}; ${formatEntry(limit)} is left. This settles only this expense.`
          : `They owe ${formatEntry(outstanding)}. Their oldest shares are settled first.`
      }
      footer={<Button label={target ? 'Mark paid' : 'Record payment'} fullWidth onPress={save} />}
    >
      <View style={{ gap: theme.space[4] }}>
        <TextField
          label="Amount paid"
          value={amountText}
          onChangeText={(value) => {
            setAmountText(value);
            setError(null);
          }}
          money
          maxLength={14}
        />
        <View style={{ gap: theme.space[2] }}>
          <Text variant="label" color="textSecondary">
            Received in
          </Text>
          <AccountPicker
            columns={2}
            selectedId={accountId}
            onChoose={(id) => {
              setAccountId(id);
              setError(null);
            }}
          />
        </View>
        {error ? (
          <Text role="alert" color="danger" variant="label">
            {error}
          </Text>
        ) : (
          <Text color="textSecondary" variant="label">
            The money is added to that account. It is not counted as income.
          </Text>
        )}
      </View>
    </Sheet>
  );
}
