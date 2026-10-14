import type { RefObject } from 'react';
import { Pressable, View, type TextInput } from 'react-native';
import { Text } from '@/components/ui';
import { amountToInput, evaluateAmount, isExpression } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { formatEntry } from '../format';
import { useTransactionForm } from '../state/transactionForm';
import { EntryInput } from './EntryInput';
import { FieldRow } from './FieldRow';

const KEYS = [
  { key: '+', label: '+', name: 'Plus' },
  { key: '-', label: '−', name: 'Minus' },
  { key: '×', label: '×', name: 'Times' },
  { key: '÷', label: '÷', name: 'Divided by' },
] as const;

/**
 * The amount, with a small calculator: type or tap + − × ÷ ("120+45") and the result
 * shows underneath; Enter (or leaving the field) turns the sum into the amount.
 */
export function AmountField({ inputRef }: { inputRef: RefObject<TextInput | null> }) {
  const theme = useTheme();
  const text = useTransactionForm((state) => state.draft.amountText);
  const active = useTransactionForm((state) => state.active === 'amount');
  const error = useTransactionForm((state) => state.errors.amount);
  const update = useTransactionForm((state) => state.update);
  const setActive = useTransactionForm((state) => state.setActive);
  const advance = useTransactionForm((state) => state.advance);
  const sum = isExpression(text);
  const result = sum ? evaluateAmount(text) : null;
  const settle = () => {
    if (sum && result !== null) update({ amountText: amountToInput(result) });
  };
  return (
    <FieldRow label="Amount" active={active} error={error}>
      <View style={{ gap: 4 }}>
        <EntryInput
          ref={inputRef}
          money
          size="lg"
          value={text}
          onChangeText={(amountText) => update({ amountText })}
          onFocus={() => setActive('amount')}
          onBlur={settle}
          onSubmitEditing={() => {
            settle();
            advance('amount');
          }}
          returnKeyType="next"
          placeholder="0"
          accessibilityLabel="Amount in rupees"
        />
        {sum ? (
          <Text variant="caption" color={result === null ? 'danger' : 'textSecondary'}>
            {result === null ? 'Not a valid sum yet' : `= ${formatEntry(result)}`}
          </Text>
        ) : null}
        {active ? (
          <View style={{ flexDirection: 'row', gap: theme.space[2], paddingBottom: 4 }}>
            {KEYS.map((item) => (
              <Pressable
                key={item.key}
                role="button"
                accessibilityLabel={item.name}
                onPress={() => {
                  update({
                    amountText: `${useTransactionForm.getState().draft.amountText}${item.key}`,
                  });
                  inputRef.current?.focus();
                }}
                style={{
                  minWidth: 44,
                  height: 44,
                  borderRadius: theme.radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text variant="bodyStrong">{item.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </FieldRow>
  );
}
