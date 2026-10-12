import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { BarChart } from '@/components/charts';
import { Card, CardHeader, Money, Text, type MoneyTone } from '@/components/ui';
import { useFitMode } from '@/components/layout/Screen';
import {
  monthLabel,
  monthOf,
  todayIso,
  yearOfMonth,
  yearSummary,
  yearTotals,
} from '@/lib/domain/expenses';
import { formatAxisMoney, formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { useLedger } from '../hooks/useLedger';
import { useExpenseUi } from '../state/expenseUi';

/** The selected year: income vs expenses per month and the year's totals. */
export function YearPanel({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const fit = useFitMode(true);
  const { transactions } = useLedger();
  const month = useExpenseUi((state) => state.month);
  const accountId = useExpenseUi((state) => state.accountId);
  const year = yearOfMonth(month);
  const current = monthOf(todayIso());
  const months = useMemo(
    () =>
      yearSummary(year, transactions, accountId).filter(
        (item) => yearOfMonth(current) !== year || item.month <= current,
      ),
    [year, transactions, accountId, current],
  );
  const totals = useMemo(
    () => yearTotals(year, transactions, accountId),
    [year, transactions, accountId],
  );
  const average = months.length ? Math.round(totals.expense / months.length) : 0;
  return (
    <Card index={2} style={[{ gap: theme.space[3] }, style]}>
      <CardHeader title={`${year} at a glance`} subtitle="Income and expenses by month" />
      <BarChart
        height={fit ? undefined : 200}
        data={months.map((item) => ({
          label: monthLabel(item.month, 'short'),
          values: [item.income, item.expense],
          projected: item.month === current,
        }))}
        series={[
          { name: 'Income', color: theme.colors.chartPositive },
          { name: 'Expenses', color: theme.colors.chartNegative },
        ]}
        formatValue={formatMoneyWhole}
        formatAxis={formatAxisMoney}
        accessibilityLabel={`Income and expenses for each month of ${year}. Income ${formatMoneyWhole(totals.income)}, expenses ${formatMoneyWhole(totals.expense)}.`}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.space[3] }}>
        <Figure label="Income" value={totals.income} tone="income" />
        <Figure label="Expenses" value={totals.expense} tone="expense" />
        <Figure label="Net" value={totals.net} tone="auto" />
        <Figure label="Avg. spend / month" value={average} tone="neutral" />
      </View>
    </Card>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone: MoneyTone }) {
  return (
    <View style={{ width: '50%', gap: 2 }}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Money value={value} tone={tone} whole variant="bodyStrong" numberOfLines={1} />
    </View>
  );
}
