import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { amountToInput, parseLimitedAmount } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { EntryInput } from '../entry/EntryInput';

type BudgetEditorProps = {
  name: string;
  /** Current monthly budget in paise, or null when there is none. */
  value: number | null;
  onSave: (budget: number | null) => void;
  onCancel: () => void;
};

/** Inline monthly budget input: Enter saves, Escape cancels. */
export function BudgetEditor({ name, value, onSave, onCancel }: BudgetEditorProps) {
  const theme = useTheme();
  const [text, setText] = useState(value ? amountToInput(value) : '');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const amount = parseLimitedAmount(text);
    if (amount === null) {
      setError('Enter a monthly amount like 5,000.');
      return;
    }
    onSave(amount);
  };
  return (
    <View style={{ gap: theme.space[2] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          flexWrap: 'wrap',
        }}
      >
        <View
          style={{
            flexGrow: 1,
            minWidth: 140,
            paddingHorizontal: theme.space[3],
            borderRadius: theme.radius.md,
            borderWidth: 1.5,
            borderColor: error ? theme.colors.danger : theme.colors.accent,
          }}
        >
          <EntryInput
            money
            autoFocus
            value={text}
            onChangeText={(next) => {
              setText(next);
              setError(null);
            }}
            onSubmitEditing={save}
            onKeyPress={(event) => {
              if (event.nativeEvent.key === 'Escape') onCancel();
            }}
            placeholder="Monthly budget"
            accessibilityLabel={`Monthly budget for ${name}, in rupees`}
          />
        </View>
        <Button label="Save" size="sm" variant="ink" onPress={save} />
        {value ? (
          <Button label="Remove" size="sm" variant="secondary" onPress={() => onSave(null)} />
        ) : null}
        <Button label="Cancel" size="sm" variant="ghost" onPress={onCancel} />
      </View>
      {error ? (
        <Text variant="caption" color="danger" role="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
