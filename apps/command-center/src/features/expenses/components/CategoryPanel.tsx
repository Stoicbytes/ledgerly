import { Link, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { DonutChart } from '@/components/charts';
import { ChartPie } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Card, CardHeader, Money, Text } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { categoryBreakdown, limitSlices, monthLabel } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { useLedger } from '../hooks/useLedger';
import { useMonthView } from '../hooks/useMonthView';
import { useSliceColors } from '../sliceColors';
import { useExpenseUi } from '../state/expenseUi';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { formatShare, SliceRow } from './SliceRow';

const STATS: Href = '/dashboard/expenses/stats' as Href;

/** Where this month's money went: donut and ranked categories (opens Stats on press). */
export function CategoryPanel({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const router = useRouter();
  const { isDense } = useBreakpoint();
  const { range, accountId, month, totals } = useMonthView();
  const { transactions, categories } = useLedger();
  const setStatsKind = useExpenseUi((state) => state.setStatsKind);
  const setStatsPeriod = useExpenseUi((state) => state.setStatsPeriod);
  const drillInto = useExpenseUi((state) => state.drillInto);
  const [active, setActive] = useState<string | null>(null);
  const slices = useMemo(
    () => limitSlices(categoryBreakdown(transactions, categories, 'expense', range, accountId), 7),
    [transactions, categories, range, accountId],
  );
  const colors = useSliceColors(slices);
  const openStats = (categoryId: string) => {
    setStatsKind('expense');
    setStatsPeriod('month');
    drillInto(categoryId);
    router.push(STATS);
  };
  return (
    <Card index={2} style={[{ gap: theme.space[3] }, style]}>
      <CardHeader
        title="Where it went"
        subtitle={`Expenses in ${monthLabel(month)}`}
        action={
          <Link href={STATS} accessibilityLabel="Open spending stats">
            <Text variant="label" color="accent">
              Stats
            </Text>
          </Link>
        }
      />
      {slices.length ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <DonutChart
              size={isDense ? 128 : 156}
              thickness={isDense ? 14 : 18}
              activeLabel={active}
              segments={slices.map((slice, index) => ({
                label: slice.name,
                value: slice.amount,
                color: colors[index],
              }))}
              accessibilityLabel={`Expenses by category, ${formatMoneyWhole(totals.expense)} in total. ${slices
                .slice(0, 3)
                .map((slice) => `${slice.name} ${formatShare(slice.share)}`)
                .join(', ')}.`}
            >
              <Text variant="caption" color="textSecondary">
                Spent
              </Text>
              <Money value={totals.expense} whole variant={isDense ? 'bodyStrong' : 'title'} />
            </DonutChart>
          </View>
          <PanelScroll>
            {slices.map((slice, index) => (
              <SliceRow
                key={slice.id}
                slice={slice}
                color={colors[index]}
                active={active === slice.name}
                onHover={setActive}
                onPress={slice.category ? () => openStats(slice.id) : undefined}
              />
            ))}
          </PanelScroll>
        </>
      ) : (
        <EmptyState
          icon={ChartPie}
          title="No spending yet"
          body="Expenses for this month will be broken down here."
        />
      )}
    </Card>
  );
}
