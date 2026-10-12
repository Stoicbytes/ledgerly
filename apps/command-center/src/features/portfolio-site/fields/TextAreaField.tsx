import { TextInput, View } from 'react-native';
import { Text } from '@/components/ui';
import { fontFamily, useTheme } from '@/theme';

/** A labelled multi-line input with a character count near the limit. */
export function TextAreaField({
  label,
  value,
  onChangeText,
  max,
  rows = 4,
  hint,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  max: number;
  rows?: number;
  hint?: string;
  error?: string;
  placeholder?: string;
}) {
  const theme = useTheme();
  const nearLimit = value.length > max * 0.85;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={max}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        textAlignVertical="top"
        style={{
          minHeight: 22 * rows + 20,
          paddingHorizontal: theme.space[3],
          paddingVertical: 10,
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor: error ? theme.colors.danger : theme.colors.borderStrong,
          backgroundColor: theme.colors.surface,
          color: theme.colors.textPrimary,
          fontFamily: fontFamily.regular,
          fontSize: 14,
          lineHeight: 21,
          outlineWidth: 0,
        }}
      />
      {error ? (
        <Text variant="caption" color="danger" role="alert">
          {error}
        </Text>
      ) : hint || nearLimit ? (
        <Text variant="caption" color="textTertiary">
          {[hint, nearLimit ? `${max - value.length} characters left` : '']
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}
