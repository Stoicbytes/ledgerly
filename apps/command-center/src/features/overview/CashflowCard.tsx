import { View } from 'react-native';
import { BarChart } from '@/components/charts';
import { Card, CardHeader, Text } from '@/components/ui';
import { formatAxisMoney, formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type FlowMonth = { label: string; income: number; expense: number; projected?: boolean };

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
        accessibilityLabel={`Income and expenses by month. Last full month, ${latest.label}: income ${formatMoneyWhole(latest.income)}, expenses ${formatMoneyWhole(latest.expense)}. Current month is partial and drawn hatched.`}
      />
    </Card>
  );
}
