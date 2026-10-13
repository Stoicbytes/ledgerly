import { View } from 'react-native';
import { Plus, X } from '@/components/icons';
import { Button, IconButton, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { PickChip } from '@/features/expenses/entry/PickChip';
import { useTheme } from '@/theme';

/** A payslip line while it is typed: the amount stays text until saved. */
export type LineDraft = { key: string; label: string; amount: string };

let counter = 0;
export const newLine = (label = '', amount = ''): LineDraft => ({
  key: `line-${(counter += 1)}`,
  label,
  amount,
});

/** Editable earnings or deductions: a name and an amount per line, plus suggestions. */
export function PayLinesEditor({
  title,
  lines,
  onChange,
  suggestions,
  error,
}: {
  title: string;
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  suggestions: string[];
  error?: string;
}) {
  const theme = useTheme();
  const used = new Set(lines.map((line) => line.label.trim()));
  const unused = suggestions.filter((label) => !used.has(label)).slice(0, 6);
  const update = (key: string, patch: Partial<LineDraft>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="label" color="textSecondary">
        {title}
      </Text>
      {lines.map((line, index) => (
        <View
          key={line.key}
          style={{ flexDirection: 'row', gap: theme.space[2], alignItems: 'flex-end' }}
        >
          <View style={{ flex: 3 }}>
            <TextField
              label={index === 0 ? 'Name' : ''}
              value={line.label}
              onChangeText={(label) => update(line.key, { label })}
              maxLength={60}
              placeholder="e.g. Basic"
            />
          </View>
          <View style={{ flex: 2 }}>
            <TextField
              label={index === 0 ? 'Amount' : ''}
              money
              value={line.amount}
              onChangeText={(amount) => update(line.key, { amount })}
              placeholder="0"
            />
          </View>
          <IconButton
            icon={X}
            accessibilityLabel={`Remove ${line.label || 'line'}`}
            onPress={() => onChange(lines.filter((item) => item.key !== line.key))}
          />
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        {unused.map((label) => (
          <PickChip
            key={label}
            label={label}
            onPress={() => onChange([...lines, newLine(label)])}
          />
        ))}
        <Button
          label="Add line"
          icon={Plus}
          variant="ghost"
          size="sm"
          onPress={() => onChange([...lines, newLine()])}
        />
      </View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
