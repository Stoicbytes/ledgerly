import { View } from 'react-native';
import { Text } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { Totals } from '@/lib/domain/expenses';
import { formatAxisMoney, formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type TotalsRowProps = {
  label: string;
  caption?: string;
  values: Totals | null;
  header?: boolean;
  strong?: boolean;
  /** A week still ahead: amounts show as a dash rather than ₹0. */
  upcoming?: boolean;
};

/** Month · Income · Expenses · Total columns, shared by header, months and weeks. */
export function TotalsRow({
  label,
  caption,
  values,
  header = false,
  strong = false,
  upcoming = false,
}: TotalsRowProps) {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  const money = (value: number, sign: boolean) =>
    upcoming
      ? '—'
      : isMobile
        ? `${sign && value > 0 ? '+' : ''}${formatAxisMoney(value)}`
        : formatMoneyWhole(value, sign ? 'always' : 'auto');
  const cell = (text: string, color: 'income' | 'expense' | 'textPrimary' | 'textTertiary') => (
    <Text
      variant={header ? 'caption' : strong ? 'label' : 'caption'}
      color={header ? 'textTertiary' : color}
      numeric
      numberOfLines={1}
      style={{ flex: 1, textAlign: 'right' }}
    >
      {text}
    </Text>
  );
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        paddingVertical: header ? theme.space[1] : theme.space[2],
        paddingHorizontal: theme.space[2],
        paddingRight: header ? 44 : theme.space[2],
      }}
    >
      <View style={{ flex: isMobile ? 1.1 : 1.6, minWidth: 0 }}>
        <Text
          variant={header ? 'caption' : strong ? 'bodyStrong' : 'label'}
          color={header ? 'textTertiary' : strong ? 'textPrimary' : 'textSecondary'}
          numberOfLines={1}
        >
          {label}
        </Text>
        {caption && !isMobile ? (
          <Text variant="caption" color="textTertiary" numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {values ? (
        <>
          {cell(money(values.income, false), values.income ? 'income' : 'textTertiary')}
          {cell(money(values.expense, false), values.expense ? 'expense' : 'textTertiary')}
          {cell(money(values.net, true), upcoming ? 'textTertiary' : 'textPrimary')}
        </>
      ) : (
        <>
          {cell('Income', 'textTertiary')}
          {cell('Expenses', 'textTertiary')}
          {cell('Total', 'textTertiary')}
        </>
      )}
    </View>
  );
}
