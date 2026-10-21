import { View } from 'react-native';
import { Sparkline } from '@/components/charts';
import { Text } from '@/components/ui';
import { monthLabel } from '@/lib/domain/expenses';
import type { NetWorthPoint } from '@/lib/domain/insights';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

/**
 * Net worth at each month end (from three months of history): a sparkline with the first
 * and latest figures in words, and how earlier months are counted.
 */
export function NetWorthTrend({ points }: { points: NetWorthPoint[] }) {
  const theme = useTheme();
  if (points.length < 3) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const change = last.total - first.total;
  const since = monthLabel(first.month);
  return (
    <View
      accessible
      accessibilityLabel={`Net worth, last ${points.length} months: ${money(first.total)} at the end of ${since}, ${money(last.total)} now.`}
      style={{ gap: theme.space[1], marginTop: theme.space[1] }}
    >
      <Sparkline values={points.map((point) => point.total)} height={36} />
      <Text variant="caption" color="textSecondary">
        {`${change >= 0 ? 'Up' : 'Down'} ${money(Math.abs(change))} since the end of ${since} (${money(first.total)})`}
      </Text>
      <Text variant="caption" color="textTertiary">
        Past months: your entries, the prices stored for each month and PF as entered.
      </Text>
    </View>
  );
}
