import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { DateField } from '@/features/investments/components/DateField';
import { todayIso } from '@/lib/domain/expenses';
import type { FieldSpec, FieldValue } from '@/lib/domain/site';
import { useTheme } from '@/theme';

/** A number typed as text (so "2." can be typed), and a date that can be left empty. */
export function NumberField({
  field,
  value,
  onChange,
  error,
}: {
  field: FieldSpec;
  value: FieldValue;
  onChange: (v: number | null) => void;
  error?: string;
}) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  return (
    <TextField
      label={field.label}
      value={text}
      onChangeText={(next) => {
        setText(next);
        const n = Number(next.replace(/,/g, ''));
        onChange(next.trim() && Number.isFinite(n) ? n : null);
      }}
      inputMode="decimal"
      keyboardType="decimal-pad"
      hint={field.hint}
      error={error}
    />
  );
}

export function OptionalDate({
  field,
  value,
  onChange,
  error,
}: {
  field: FieldSpec;
  value: string | null;
  onChange: (v: string | null) => void;
  error?: string;
}) {
  const theme = useTheme();
  if (!value) {
    return (
      <View style={{ gap: 6 }}>
        <Text variant="label" color="textSecondary">
          {field.label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <Button
            label="Add date"
            size="sm"
            variant="secondary"
            onPress={() => onChange(todayIso())}
          />
          {field.hint ? (
            <Text variant="caption" color="textTertiary" style={{ flex: 1 }}>
              {field.hint}
            </Text>
          ) : null}
        </View>
        {error ? (
          <Text variant="caption" color="danger" role="alert">
            {error}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ gap: 4 }}>
      <DateField label={field.label} value={value} onChange={onChange} error={error} />
      {!field.required ? (
        <Button label="Clear date" size="sm" variant="ghost" onPress={() => onChange(null)} />
      ) : null}
    </View>
  );
}
