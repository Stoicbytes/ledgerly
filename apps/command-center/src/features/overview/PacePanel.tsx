import { View } from 'react-native';
import { TrendLineChart } from '@/components/charts';
import { Text } from '@/components/ui';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import type { MonthPulse } from './insights';
import { Panel } from './PulsePanel';

/** Spending added up day by day this month, against last month's (dashed). */
export function PacePanel({ pulse, month }: { pulse: MonthPulse; month: string }) {
  const theme = useTheme();
  const { pace, projection } = pulse;
  const today = pace[pace.length - 1];
  const legend = (color: string, label: string, dashed = false) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 14,
          height: 0,
          borderTopWidth: 2,
          borderStyle: dashed ? 'dashed' : 'solid',
          borderColor: color,
        }}
      />
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </View>
  );
  return (
    <Panel basis={380}>
      <View style={{ gap: 2 }}>
        <Text variant="caption" color="textSecondary">
          Spending pace
        </Text>
        <Text variant="figureSm">{money(today?.spent ?? 0)} so far</Text>
        <Text variant="caption" color="textSecondary">
          {projection
            ? `Heading for about ${money(projection.projected)} by month-end`
            : 'A month-end figure shows from the 5th'}
          {today ? ` · last month by now ${money(today.last)}` : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.space[4] }}>
        {legend(theme.colors.pie[1], month)}
        {legend(theme.colors.textSecondary, 'Last month', true)}
      </View>
      {pace.length > 1 ? (
        <TrendLineChart
          height={150}
          points={pace.map((item) => ({
            label: String(item.day),
            value: item.spent,
            name: `${month} ${item.day}`,
          }))}
          compare={{ name: 'Last month', values: pace.map((item) => item.last) }}
          formatValue={money}
          tooltip={(index) => ({
            title: `Day ${pace[index].day}`,
            rows: [
              { label: month, value: money(pace[index].spent), color: theme.colors.pie[1] },
              { label: 'Last month', value: money(pace[index].last) },
            ],
          })}
          accessibilityLabel={`Spending so far in ${month}, day by day, against last month`}
        />
      ) : (
        <Text variant="caption" color="textSecondary">
          The chart starts on the 2nd of the month.
        </Text>
      )}
    </Panel>
  );
}
