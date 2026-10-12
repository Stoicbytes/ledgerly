import { Pressable, View, type PressableProps } from 'react-native';
import type { LucideIcon } from '../icons';
import { useInteractionState } from '@/hooks/useInteractionState';
import { minHitSize, useTheme } from '@/theme';
import { TooltipBubble } from './TooltipBubble';

type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: LucideIcon;
  /** Required: icon-only controls must be named for assistive tech. */
  accessibilityLabel: string;
  /** `surface` is the white circle used in the header; `ink` is the active state. */
  variant?: 'plain' | 'surface' | 'muted' | 'ink' | 'primary';
  tone?: 'default' | 'accent' | 'danger';
  size?: 'sm' | 'md';
  selected?: boolean;
  /** Show the label as a hover/focus tooltip (useful for icon rails). */
  tooltip?: 'right' | 'top';
};

export function IconButton({
  icon: Icon,
  variant = 'plain',
  tone = 'default',
  size = 'md',
  selected = false,
  tooltip,
  disabled,
  accessibilityLabel,
  ...rest
}: IconButtonProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  const box = size === 'sm' ? 30 : 36;
  const resolved = selected ? 'ink' : variant;
  const background = {
    plain: hovered ? theme.colors.surfaceMuted : 'transparent',
    surface: hovered ? theme.colors.surfaceMuted : theme.colors.surface,
    muted: hovered ? theme.colors.border : theme.colors.surfaceMuted,
    ink: theme.colors.ink,
    primary: hovered ? theme.colors.primaryPressed : theme.colors.primary,
  }[resolved];
  const iconColor =
    resolved === 'ink'
      ? theme.colors.onInk
      : resolved === 'primary'
        ? theme.colors.onPrimary
        : tone === 'accent'
          ? theme.colors.accent
          : tone === 'danger'
            ? theme.colors.danger
            : theme.colors.textPrimary;

  return (
    <View>
      <Pressable
        role="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled, selected }}
        disabled={disabled}
        hitSlop={(minHitSize - box) / 2}
        {...handlers}
        {...rest}
        style={({ pressed }) => [
          {
            width: box,
            height: box,
            borderRadius: box / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: background,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
          focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
        ]}
      >
        <Icon size={size === 'sm' ? 15 : 17} color={iconColor} strokeWidth={1.9} />
      </Pressable>
      {tooltip && (hovered || focused) ? (
        <TooltipBubble label={accessibilityLabel} placement={tooltip} />
      ) : null}
    </View>
  );
}
