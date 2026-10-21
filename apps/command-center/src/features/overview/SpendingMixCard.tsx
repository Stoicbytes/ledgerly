import { Link, type Href } from 'expo-router';
import { View } from 'react-native';
import { Card, CardHeader, Text } from '@/components/ui';
import type { SpendingRow } from '@/lib/domain/insights';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type SpendingMixCardProps = {
  spending: { rows: SpendingRow[]; total: number; previousTotal: number };
  /** What "last month" means here, e.g. "vs 1–21 Sep". */
  comparison: string;
  index?: number;
};

const change = (now: number, before: number) => {
  if (!before) return now ? 'new this month' : '';
  const delta = now - before;
  if (!delta) return 'no change';
  return `${delta > 0 ? 'up' : 'down'} ${money(Math.abs(delta))}`;
};

/**
 * This month's spending by category: the five largest and "Other" as bars on one scale,
 * each with its amount and the change against the same days of last month.
 */
export function SpendingMixCard({ spending, comparison, index = 9 }: SpendingMixCardProps) {
  const theme = useTheme();
  const { rows, total, previousTotal } = spending;
  const largest = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <Card index={index} style={{ gap: theme.space[4], flex: 1 }}>
      <CardHeader
        title="Spending by category"
        subtitle={
          total
            ? `${money(total)} this month${previousTotal ? ` · ${change(total, previousTotal)} ${comparison}` : ''}`
            : 'Nothing spent yet this month'
        }
        action={
          <Link href={'/dashboard/expenses/stats' as Href} accessibilityLabel="Open spending stats">
            <Text variant="label" color="accent">
              Stats
            </Text>
          </Link>
        }
      />
      {rows.map((row) => (
        <View
          key={row.id}
          accessible
          accessibilityLabel={`${row.name}: ${money(row.amount)}, ${Math.round(row.share * 100)}% of spending, ${change(row.amount, row.previous)}${row.previous ? ` ${comparison}` : ''}.`}
          style={{ gap: 6 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space[2] }}>
            <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
              {row.name}
            </Text>
            <Text variant="label" numeric>
              {money(row.amount)}
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.surfaceMuted }}>
            <View
              style={{
                width: `${(row.amount / largest) * 100}%`,
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.colors.chartPositive,
              }}
            />
          </View>
          <Text variant="caption" color="textSecondary">
            {Math.round(row.share * 100)}% · {change(row.amount, row.previous)}
            {row.previous ? ` ${comparison}` : ''}
          </Text>
        </View>
      ))}
    </Card>
  );
}
