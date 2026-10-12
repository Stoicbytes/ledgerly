import { View } from 'react-native';
import { TrendLineChart } from '@/components/charts';
import { Card, CardHeader, SegmentedControl, Text } from '@/components/ui';
import { monthLabel } from '@/lib/domain/expenses';
import type { ValueSeries } from '@/lib/domain/investments';
import { formatAxisMoney, formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

export type GrowthRange = 12 | 36 | 'all';

/** Month-end value (line) against the cost of what was held (dashed). */
export function GrowthCard({
  series,
  range,
  onRange,
  title = 'Growth',
  style,
}: {
  series: ValueSeries;
  range: GrowthRange;
  onRange: (range: GrowthRange) => void;
  title?: string;
  style?: object;
}) {
  const theme = useTheme();
  const { months, value, invested } = series;
  const last = value.length - 1;
  return (
    <Card index={5} style={[{ gap: theme.space[2] }, style]}>
      <CardHeader
        title={title}
        subtitle="Value (line) vs cost of what you held (dashed)"
        action={
          <SegmentedControl
            size="sm"
            fill={false}
            accessibilityLabel="Range"
            value={String(range)}
            onChange={(next) => onRange(next === 'all' ? 'all' : (Number(next) as 12 | 36))}
            segments={[
              { value: '12', label: '1Y' },
              { value: '36', label: '3Y' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />
      {months.length >= 2 && value.some(Boolean) ? (
        <TrendLineChart
          points={months.map((month, index) => ({
            label: monthLabel(month, 'short'),
            value: value[index],
            name: monthLabel(month),
          }))}
          compare={{ name: 'Cost', values: invested }}
          formatValue={formatAxisMoney}
          accessibilityLabel={`Value went from ${formatMoneyWhole(value[0])} to ${formatMoneyWhole(value[last])}, against ${formatMoneyWhole(invested[last])} cost.`}
        />
      ) : (
        <View style={{ flex: 1, minHeight: 120, justifyContent: 'center' }}>
          <Text variant="caption" color="textTertiary" align="center">
            The chart fills in as you add transactions.
          </Text>
        </View>
      )}
    </Card>
  );
}
