import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import type { LucideIcon } from '../icons';
import { useInteractionState } from '@/hooks/useInteractionState';
import { minHitSize, useTheme, type ColorRoles } from '@/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'ink' | 'secondary' | 'ghost' | 'danger' | 'onBrand';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
};

const heights: Record<ButtonSize, number> = { sm: 30, md: 36, lg: 42 };

type Palette = { bg: string; bgActive: string; fg: keyof ColorRoles };

function palette(variant: ButtonVariant, colors: ColorRoles): Palette {
  switch (variant) {
    case 'primary':
      return { bg: colors.primary, bgActive: colors.primaryPressed, fg: 'onPrimary' };
    case 'ink':
      return { bg: colors.ink, bgActive: colors.inkPressed, fg: 'onInk' };
    case 'danger':
      return { bg: colors.danger, bgActive: colors.danger, fg: 'onDanger' };
    case 'secondary':
      return { bg: colors.surfaceMuted, bgActive: colors.border, fg: 'textPrimary' };
    case 'ghost':
      return { bg: 'transparent', bgActive: colors.surfaceMuted, fg: 'accent' };
    case 'onBrand':
      return { bg: 'rgba(255,255,255,0.16)', bgActive: 'rgba(255,255,255,0.26)', fg: 'onBrand' };
  }
}

/** Pill button. Primary is black with white text (inverted in dark mode) (the main action on a screen). */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  const colors = palette(variant, theme.colors);
  const fg = theme.colors[colors.fg] as string;
  const inactive = disabled || loading;

  return (
    <Pressable
      role="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      hitSlop={size === 'sm' ? (minHitSize - heights.sm) / 2 : undefined}
      {...handlers}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: size === 'sm' ? theme.space[4] : theme.space[5],
          backgroundColor: pressed || hovered ? colors.bgActive : colors.bg,
          opacity: inactive ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : undefined,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        focused && {
          outlineColor: theme.colors.focus,
          outlineWidth: 2,
          outlineOffset: 2,
          outlineStyle: 'solid',
        },
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : Icon ? (
          <Icon size={size === 'lg' ? 18 : size === 'sm' ? 14 : 16} color={fg} strokeWidth={2} />
        ) : null}
        <Text
          variant={size === 'sm' ? 'label' : 'bodyStrong'}
          style={{ color: fg }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
