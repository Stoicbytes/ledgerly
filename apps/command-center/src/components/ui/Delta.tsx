import { View } from 'react-native';
import { ArrowDownRight, ArrowUpRight, Minus } from '../icons';
import { formatMoney, formatPercent, moneyAccessibilityLabel } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { Text } from './Text';

type DeltaProps = {
  /** Percent value (e.g. 18.2) or integer minor units, depending on `format`. */
  value: number;
  format?: 'percent' | 'money';
  /** Which direction is favourable for this metric (expenses: down). */
  goodWhen?: 'up' | 'down';
  /** e.g. "vs Sep". Shown and read aloud. */
  comparison?: string;
  /** `pill` = compact tinted chip (KPI cards); `onBrand` = for gradient cards. */
  variant?: 'inline' | 'pill' | 'onBrand';
};

/**
 * Change indicator. Direction is conveyed by arrow, sign and words — never by
 * colour alone.
 */
export function Delta({
  value,
  format = 'percent',
  goodWhen = 'up',
  comparison,
  variant = 'inline',
}: DeltaProps) {
  const theme = useTheme();
  const rounded = format === 'percent' ? Math.round(value * 10) / 10 : Math.round(value);
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  const favourable = direction === 'flat' ? null : direction === goodWhen;
  const tone = favourable === null ? 'textSecondary' : favourable ? 'success' : 'danger';
  const soft = favourable === null ? 'surfaceMuted' : favourable ? 'successSoft' : 'dangerSoft';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const text =
    direction === 'flat'
      ? 'No change'
      : format === 'percent'
        ? formatPercent(value)
        : formatMoney(value, { signDisplay: 'always' });
  const spoken =
    direction === 'flat'
      ? 'No change'
      : `${direction === 'up' ? 'Up' : 'Down'} ${
          format === 'percent'
            ? `${Math.abs(value).toFixed(1)} percent`
            : moneyAccessibilityLabel(Math.abs(value))
        }`;
  const verdict = favourable === null ? '' : favourable ? ', favourable' : ', unfavourable';
  const onBrand = variant === 'onBrand';
  const chipColor = onBrand ? theme.colors.onBrand : theme.colors[tone];

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
      accessible
      accessibilityLabel={`${spoken}${comparison ? ` ${comparison}` : ''}${verdict}`}
    >
      <View
        style={
          variant === 'inline'
            ? { flexDirection: 'row', alignItems: 'center', gap: 3 }
            : {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: theme.radius.pill,
                backgroundColor: onBrand ? 'rgba(255,255,255,0.18)' : theme.colors[soft],
              }
        }
      >
        <Icon size={13} color={chipColor} strokeWidth={2.4} />
        <Text variant="caption" style={{ color: chipColor }} numeric>
          {text}
        </Text>
      </View>
      {comparison ? (
        <Text variant="caption" color={onBrand ? 'onBrandMuted' : 'textSecondary'}>
          {comparison}
        </Text>
      ) : null}
    </View>
  );
}
