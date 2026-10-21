import { View } from 'react-native';
import { BarChart } from '@/components/charts';
import { Card, CardHeader, Text } from '@/components/ui';
import { formatAxisMoney, formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type FlowMonth = {
  label: string;
  income: number;
  expense: number;
  net: number;
  projected?: boolean;
};

export function CashflowCard({
  flow,
  index = 5,
  height,
}: {
  flow: FlowMonth[];
  index?: number;
  height?: number;
}) {
  const theme = useTheme();
  const series = [
    { name: 'Income', color: theme.colors.chartPositive },
    { name: 'Expenses', color: theme.colors.chartNegative },
  ];
  const latest = flow[flow.length - 2];
  // The six full months before this one.
  const full = flow.slice(-7, -1);
  const average = Math.round(full.reduce((sum, month) => sum + month.net, 0) / full.length);
  return (
    <Card index={index} style={{ gap: theme.space[3], flex: 1 }}>
      <CardHeader
        title="Cash flow"
        subtitle="Income vs expenses, last 8 months"
        action={
          <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
            {series.map((item) => (
              <View key={item.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }}
                />
                <Text variant="caption" color="textSecondary">
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        }
      />
      <BarChart
        height={height}
        data={flow.map((month) => ({
          label: month.label,
          values: [month.income, month.expense],
          projected: month.projected,
        }))}
        series={series}
        formatValue={(value) => formatMoneyWhole(value)}
        formatAxis={formatAxisMoney}
        details={(index) => [
          {
            label: flow[index].net < 0 ? 'Overspent' : 'Saved',
            value: formatMoneyWhole(Math.abs(flow[index].net)),
          },
        ]}
        accessibilityLabel={`Income and expenses by month. Last full month, ${latest.label}: income ${formatMoneyWhole(latest.income)}, expenses ${formatMoneyWhole(latest.expense)}. Current month is partial and drawn hatched.`}
      />
      <Text variant="caption" color="textSecondary">
        {`${latest.net < 0 ? 'Overspent' : 'Saved'} ${formatMoneyWhole(Math.abs(latest.net))} in ${latest.label} · ${formatMoneyWhole(average)} a month on average over 6 months`}
      </Text>
    </Card>
  );
}
