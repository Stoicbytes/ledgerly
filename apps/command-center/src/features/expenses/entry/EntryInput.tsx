import type { Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from '@/components/ui';
import { fontFamily, useTheme } from '@/theme';

type EntryInputProps = Omit<TextInputProps, 'style'> & {
  ref?: Ref<TextInput>;
  /** Money inputs get a ₹ prefix, a decimal keypad and large figures. */
  money?: boolean;
  size?: 'lg' | 'md';
};

/** Borderless input that sits inside a FieldRow. */
export function EntryInput({ ref, money = false, size = 'md', ...rest }: EntryInputProps) {
  const theme = useTheme();
  const fontSize = size === 'lg' ? 20 : 14;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {money ? (
        <Text variant={size === 'lg' ? 'figureSm' : 'bodyStrong'} color="textSecondary" aria-hidden>
          ₹
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textTertiary}
        keyboardType={money ? 'decimal-pad' : 'default'}
        inputMode={money ? 'decimal' : 'text'}
        maxFontSizeMultiplier={2}
        {...rest}
        style={{
          flex: 1,
          minWidth: 0,
          paddingVertical: 6,
          color: theme.colors.textPrimary,
          fontFamily: money ? fontFamily.semibold : fontFamily.regular,
          fontSize,
          outlineWidth: 0,
        }}
      />
    </View>
  );
}
