import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { fontFamily, useTheme, type ColorRoles, type TypeVariant } from '@/theme';

type TextColor = Extract<
  keyof ColorRoles,
  | 'textPrimary'
  | 'textSecondary'
  | 'textTertiary'
  | 'accent'
  | 'onAccent'
  | 'income'
  | 'expense'
  | 'profit'
  | 'loss'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'investment'
  | 'transfer'
  | 'onDanger'
  | 'onInverseSurface'
  | 'onPrimary'
  | 'onInk'
  | 'onInkMuted'
  | 'onBrand'
  | 'onBrandMuted'
  | 'inverseAccent'
>;

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: TextColor;
  align?: TextStyle['textAlign'];
  /** Tabular figures so columns of numbers line up. */
  numeric?: boolean;
  uppercase?: boolean;
};

export function Text({
  variant = 'body',
  color = 'textPrimary',
  align,
  numeric = false,
  uppercase = false,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const type = theme.type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={2}
      {...rest}
      style={[
        {
          color: theme.colors[color],
          fontFamily: fontFamily[type.weight],
          fontSize: type.fontSize,
          lineHeight: type.lineHeight,
          letterSpacing: 'letterSpacing' in type ? type.letterSpacing : undefined,
          textAlign: align,
          textTransform: uppercase ? 'uppercase' : undefined,
          fontVariant: numeric ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}

type HeadingProps = TextProps & {
  level?: 1 | 2 | 3;
};

const variantForLevel = { 1: 'h1', 2: 'h2', 3: 'title' } as const;

/** Semantic heading: announced as a heading natively, rendered as <h1>-<h3> on web. */
export function Heading({ level = 2, variant, ...rest }: HeadingProps) {
  return (
    <Text role="heading" aria-level={level} variant={variant ?? variantForLevel[level]} {...rest} />
  );
}
