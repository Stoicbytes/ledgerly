import { View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Coins, Landmark, type LucideIcon } from '@/components/icons';
import { Card, CategoryIcon, Delta, Money, Text, type MoneyTone } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { monthLabel } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { useMonthView } from '../hooks/useMonthView';

type Stat = {
  icon: LucideIcon;
  tint: number;
  label: string;
  value: number;
  tone: MoneyTone;
  change?: { value: number | null; goodWhen: 'up' | 'down' };
  caption?: string;
};

/** Income · Expenses · Total · Balance for the selected month and account. */
export function SummaryStrip() {
  const theme = useTheme();
  const { isDesktop, isDense } = useBreakpoint();
  const view = useMonthView();
  const { totals } = view;
  const totalCaption =
    totals.income === 0
      ? totals.expense
        ? 'No income this month'
        : 'Nothing recorded yet'
      : totals.net < 0
        ? `${formatMoneyWhole(-totals.net)} more out than in`
        : `${Math.round((totals.net / totals.income) * 100)}% of income kept`;
  const stats: Stat[] = [
    {
      icon: ArrowDownLeft,
      tint: 0,
      label: 'Income',
      value: totals.income,
      tone: 'income',
      change: { value: view.deltas.income, goodWhen: 'up' },
    },
    {
      icon: ArrowUpRight,
      tint: 3,
      label: 'Expenses',
      value: totals.expense,
      tone: 'expense',
      change: { value: view.deltas.expense, goodWhen: 'down' },
    },
    {
      icon: Coins,
      tint: 2,
      label: 'Total',
      value: totals.net,
      tone: 'auto',
      caption: totalCaption,
    },
    {
      icon: Landmark,
      tint: 1,
      label: 'Balance',
      value: view.balance,
      tone: 'neutral',
      caption: `${view.account?.name ?? 'All accounts'}${isDesktop ? ` · end of ${monthLabel(view.month, 'short')}` : ''}`,
    },
  ];
  return (
    <Card
      index={0}
      padding={isDense ? 3 : 4}
      style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.space[4] }}
    >
      {stats.map((stat, index) => (
        <View
          key={stat.label}
          style={{
            width: isDesktop ? '25%' : '50%',
            paddingHorizontal: theme.space[3],
            borderLeftWidth: isDesktop && index > 0 ? 1 : 0,
            borderLeftColor: theme.colors.border,
          }}
        >
          <StatItem stat={stat} comparison={view.comparison} large={isDesktop && !isDense} />
        </View>
      ))}
    </Card>
  );
}

function StatItem({ stat, comparison, large }: { stat: Stat; comparison: string; large: boolean }) {
  const theme = useTheme();
  const { isDesktop } = useBreakpoint();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
      {isDesktop ? <CategoryIcon icon={stat.icon} tint={stat.tint} size={40} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {stat.label}
        </Text>
        <Money
          value={stat.value}
          tone={stat.tone}
          whole
          animate
          variant={large ? 'figureSm' : 'title'}
          numberOfLines={1}
        />
        {stat.change ? (
          stat.change.value === null ? (
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {`No ${stat.label.toLowerCase()} ${comparison.replace(/^vs /, 'in ')}`}
            </Text>
          ) : (
            <Delta
              value={stat.change.value}
              goodWhen={stat.change.goodWhen}
              comparison={comparison}
              variant="pill"
            />
          )
        ) : (
          <Text variant="caption" color="textTertiary" numberOfLines={1}>
            {stat.caption}
          </Text>
        )}
      </View>
    </View>
  );
}
