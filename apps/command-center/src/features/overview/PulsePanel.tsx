import type { ReactNode } from 'react';
import { View } from 'react-native';
import { BarChart } from '@/components/charts';
import { ProgressBar, ProgressRing, Text } from '@/components/ui';
import { monthLabel } from '@/lib/domain/expenses';
import { pct } from '@/lib/domain/insights';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import type { MonthPulse } from './insights';

/** A grey panel inside the "This month" card. */
export function Panel({ basis, children }: { basis: number; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexBasis: basis,
        flexGrow: basis > 300 ? 2 : 1,
        flexShrink: 1,
        minWidth: 0,
        gap: theme.space[2],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      {children}
    </View>
  );
}

/** Income kept: this month as a ring, then each of the last seven months as a bar. */
export function KeptPanel({ pulse }: { pulse: MonthPulse }) {
  const theme = useTheme();
  const rate = pulse.savingsRate;
  const tone = rate === null ? 'accent' : rate < 0 ? 'danger' : rate < 20 ? 'warning' : 'success';
  return (
    <Panel basis={260}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <ProgressRing
          value={rate === null ? 0 : rate / 100}
          tone={tone}
          size={68}
          accessibilityLabel="Share of this month's income kept"
        >
          <Text variant="bodyStrong">{rate === null ? '–' : pct(rate)}</Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">
            {rate === null
              ? 'No income entered yet'
              : rate < 0
                ? 'Spending more than earned'
                : 'Of your income kept'}
          </Text>
          <Text variant="caption" color="textSecondary">
            {pulse.averageRate === null
              ? 'Income minus spending, so far this month.'
              : `${pct(pulse.averageRate)} on average over the last 6 months.`}
          </Text>
        </View>
      </View>
      <BarChart
        height={110}
        data={pulse.rates.map((item) => ({
          label: monthLabel(item.month, 'short'),
          values: [Math.max(0, item.rate ?? 0)],
        }))}
        series={[{ name: 'Kept', color: theme.colors.success }]}
        formatValue={(value) => pct(value)}
        formatAxis={(value) => `${Math.round(value)}%`}
        details={(index) => {
          const item = pulse.rates[index];
          return [
            { label: 'Income', value: money(item.income) },
            { label: item.net < 0 ? 'Overspent' : 'Kept', value: money(Math.abs(item.net)) },
          ];
        }}
        accessibilityLabel="Share of income kept in each of the last seven months"
      />
    </Panel>
  );
}

/** How many months bank, cash and wallets would last, on a 0–12 month gauge. */
export function CashPanel({ pulse }: { pulse: MonthPulse }) {
  const theme = useTheme();
  const runway = pulse.runway;
  const months = runway?.months ?? 0;
  const tone = months >= 6 ? 'success' : months >= 3 ? 'warning' : 'danger';
  return (
    <Panel basis={220}>
      <Text variant="caption" color="textSecondary">
        Cash would last
      </Text>
      <Text variant="figure" color={runway && months < 3 ? 'warning' : undefined}>
        {runway ? `${months.toFixed(1)} months` : '–'}
      </Text>
      {runway ? (
        <View style={{ gap: theme.space[1] }}>
          <ProgressBar
            value={months / 12}
            tone={tone}
            accessibilityLabel={`Cash covers ${months.toFixed(1)} of 12 months`}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {['0', '3', '6', '9', '12+'].map((mark) => (
              <Text key={mark} variant="caption" color="textSecondary">
                {mark}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      <Text variant="caption" color="textSecondary">
        {runway
          ? `${money(runway.cash)} in bank, cash and wallets, at ${money(runway.monthly)} a month. 6 months or more is a common safety net.`
          : 'Needs bank balances and past spending.'}
      </Text>
    </Panel>
  );
}
