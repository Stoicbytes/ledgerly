import type { Ref } from 'react';
import { View, type TextInput, type TextInputProps } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { EntryInput } from '../entry/EntryInput';

type TextFieldProps = Pick<
  TextInputProps,
  | 'secureTextEntry'
  | 'autoComplete'
  | 'autoCapitalize'
  | 'keyboardType'
  | 'inputMode'
  | 'textContentType'
> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  hint?: string;
  placeholder?: string;
  money?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  ref?: Ref<TextInput>;
};

/** Labelled, bordered input with its hint or error underneath (forms on management pages). */
export function TextField({ label, error, hint, ref, ...input }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <View
        style={{
          paddingHorizontal: theme.space[3],
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor: error ? theme.colors.danger : theme.colors.borderStrong,
          backgroundColor: theme.colors.surface,
        }}
      >
        <EntryInput ref={ref} accessibilityLabel={label} {...input} />
      </View>
      {error ? (
        <Text variant="caption" color="danger" role="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
