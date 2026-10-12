import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import {
  ACCOUNT_GROUP_ORDER,
  ACCOUNT_TYPE_LABELS,
  amountToInput,
  MAX_NAME_LENGTH,
  parseLimitedAmount,
  touchesAccount,
  validateName,
  type Account,
  type AccountGroup,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { TextField } from '../components/TextField';
import { PickChip } from '../entry/PickChip';
import { useLedger } from '../hooks/useLedger';
import { useExpenseStore } from '../state/expenseStore';
import { useRecurringStore } from '../state/recurringStore';

type AccountSheetProps = {
  /** null adds a new account. */
  account: Account | null;
  onClose: () => void;
  onSaved: (id: string | null) => void;
};

const owedByDefault = (group: AccountGroup) => group === 'card' || group === 'loan';

/** Add or edit an account. Cards and loans start "owed": their balance is negative. */
export function AccountSheet({ account, onClose, onSaved }: AccountSheetProps) {
  const theme = useTheme();
  const toast = useToast();
  const { accounts, transactions } = useLedger();
  const [name, setName] = useState(account?.name ?? '');
  const [group, setGroup] = useState<AccountGroup>(account?.group ?? 'bank');
  const [opening, setOpening] = useState(
    account ? amountToInput(Math.abs(account.openingBalance)) : '',
  );
  const [owed, setOwed] = useState(account ? account.openingBalance < 0 : owedByDefault('bank'));
  const [errors, setErrors] = useState<{ name?: string; opening?: string }>({});
  const repeats = useRecurringStore((state) => state.rules);
  const used =
    !!account &&
    (transactions.some((item) => touchesAccount(item, account.id)) ||
      repeats.some((rule) => rule.accountId === account.id || rule.toAccountId === account.id));
  const save = () => {
    const nameError = validateName(name, accounts, account?.id) ?? undefined;
    const amount = opening.trim() ? parseLimitedAmount(opening) : 0;
    const openingError =
      amount === null ? 'Enter an amount like 25,000, or leave it empty for zero.' : undefined;
    if (nameError || openingError) return setErrors({ name: nameError, opening: openingError });
    const openingBalance = owed ? -(amount ?? 0) : (amount ?? 0);
    const saved = useExpenseStore
      .getState()
      .saveAccount({ name: name.trim(), group, openingBalance }, account?.id);
    toast.show({ message: account ? `${saved.name} saved` : `${saved.name} added` });
    onSaved(saved.id);
  };
  const remove = () => {
    if (!account || !useExpenseStore.getState().deleteAccount(account.id)) return;
    toast.show({ message: `${account.name} deleted` });
    onSaved(null);
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={account ? `Edit ${account.name}` : 'Add account'}
      width={520}
      footer={
        <>
          {account ? (
            <Button label="Delete" variant="danger" size="sm" disabled={used} onPress={remove} />
          ) : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label={account ? 'Save' : 'Add account'} onPress={save} />
        </>
      }
    >
      <View style={{ gap: theme.space[4] }}>
        <TextField
          label="Name"
          value={name}
          onChangeText={(next) => {
            setName(next);
            setErrors((current) => ({ ...current, name: undefined }));
          }}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. HDFC savings"
          error={errors.name}
          autoFocus
        />
        <View style={{ gap: 6 }}>
          <Text variant="label" color="textSecondary">
            Type
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
            {ACCOUNT_GROUP_ORDER.map((item) => (
              <PickChip
                key={item}
                label={ACCOUNT_TYPE_LABELS[item]}
                selected={item === group}
                onPress={() => {
                  setGroup(item);
                  if (!account) setOwed(owedByDefault(item));
                }}
              />
            ))}
          </View>
        </View>
        <TextField
          label="Opening balance"
          money
          value={opening}
          onChangeText={(next) => {
            setOpening(next);
            setErrors((current) => ({ ...current, opening: undefined }));
          }}
          placeholder="0"
          hint="The balance before the first entry recorded here."
          error={errors.opening}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
          <View style={{ flex: 1 }}>
            <Text variant="label">This is money I owe</Text>
            <Text variant="caption" color="textTertiary">
              Credit cards and loans: the balance counts as a liability.
            </Text>
          </View>
          <Switch
            value={owed}
            onValueChange={setOwed}
            accessibilityLabel="This is money I owe"
            trackColor={{ false: theme.colors.borderStrong, true: theme.colors.expense }}
            thumbColor={theme.colors.surface}
          />
        </View>
        {used ? (
          <Text variant="caption" color="textTertiary">
            Accounts with entries or recurring entries cannot be deleted. Move or delete them first.
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
