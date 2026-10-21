import type { ReactNode } from 'react';
import { View } from 'react-native';
import { BarChart, TrendLineChart } from '@/components/charts';
import { Text } from '@/components/ui';
import { monthLabel } from '@/lib/domain/expenses';
import type { PayMonth } from '@/lib/domain/insights';
import { formatAxisMoney, formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type SalaryPfChartsProps = { pay: PayMonth[]; pfHistory: { month: string; balance: number }[] };

/** Net pay by month (bars; gross and tax in the tooltip) and the PF balance at month ends. */
export function SalaryPfCharts({ pay, pfHistory }: SalaryPfChartsProps) {
  const theme = useTheme();
  const range = <T extends { month: string }>(list: T[], value: (item: T) => number) => {
    const first = list[0];
    const last = list[list.length - 1];
    return `from ${money(value(first))} in ${monthLabel(first.month)} to ${money(value(last))} in ${monthLabel(last.month)}`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[5] }}>
      {pay.length ? (
        <Block title="Net pay by month" caption="Touch a month for gross pay and tax">
          <BarChart
            height={170}
            data={pay.map((item) => ({
              label: monthLabel(item.month, 'short'),
              values: [item.net],
            }))}
            series={[{ name: 'Net pay', color: theme.colors.chartPositive }]}
            formatValue={(value) => money(value)}
            formatAxis={formatAxisMoney}
            details={(index) => [
              { label: 'Gross pay', value: money(pay[index].gross) },
              { label: 'TDS', value: money(pay[index].tds) },
            ]}
            accessibilityLabel={`Net pay, last ${pay.length} months, ${range(pay, (item) => item.net)}.`}
          />
        </Block>
      ) : null}
      {pfHistory.length > 1 ? (
        <Block
          title="PF balance by month"
          caption="Your share and the employer's at each month end"
        >
          <TrendLineChart
            height={170}
            color={theme.colors.chart[0]}
            points={pfHistory.map((item) => ({
              label: monthLabel(item.month, 'short'),
              sublabel: item.month.slice(0, 4),
              value: item.balance,
              name: monthLabel(item.month),
            }))}
            formatValue={formatAxisMoney}
            tooltip={(index) => ({
              title: monthLabel(pfHistory[index].month),
              rows: [{ label: 'PF balance', value: money(pfHistory[index].balance) }],
            })}
            accessibilityLabel={`PF balance, last ${pfHistory.length} months, ${range(pfHistory, (item) => item.balance)}.`}
          />
        </Block>
      ) : null}
    </View>
  );
}

function Block({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexBasis: 300, flexGrow: 1, minWidth: 0, gap: theme.space[2] }}>
      <View style={{ gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="textSecondary">
          {caption}
        </Text>
      </View>
      {children}
    </View>
  );
}
