import { useCountUp } from '@/hooks/useTween';
import { formatMoney, moneyAccessibilityLabel, type SignDisplay } from '@/lib/formatting/currency';
import { Text, type TextProps } from './Text';

export type MoneyTone = 'neutral' | 'income' | 'expense' | 'profit' | 'loss' | 'auto';

type MoneyProps = Omit<TextProps, 'children'> & {
  /** Integer minor units (paise). */
  value: number;
  currency?: string;
  compact?: boolean;
  signDisplay?: SignDisplay;
  /** `auto` colours positive as profit and negative as loss; the sign is always shown too. */
  tone?: MoneyTone;
  /** Count up from the previous value (respects reduced motion). */
  animate?: boolean;
  /** Whole rupees (headline tiles). */
  whole?: boolean;
};

const toneColor = {
  neutral: undefined,
  income: 'income',
  expense: 'expense',
  profit: 'profit',
  loss: 'loss',
} as const;

export function Money({
  value,
  currency,
  compact,
  signDisplay = 'auto',
  tone = 'neutral',
  animate = false,
  whole = false,
  color,
  ...rest
}: MoneyProps) {
  const counted = useCountUp(value);
  const shown = animate ? counted : value;
  const resolvedTone =
    tone === 'auto' ? (value > 0 ? 'profit' : value < 0 ? 'loss' : 'neutral') : tone;
  const effectiveSign = tone === 'auto' && signDisplay === 'auto' ? 'always' : signDisplay;
  const options = { currency, compact, whole, signDisplay: effectiveSign };
  return (
    <Text
      numeric
      color={toneColor[resolvedTone] ?? color ?? 'textPrimary'}
      // The final value is announced, never the intermediate animation frames.
      accessibilityLabel={moneyAccessibilityLabel(value, options)}
      {...rest}
    >
      {formatMoney(shown, options)}
    </Text>
  );
}
