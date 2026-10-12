import { View, type StyleProp, type ViewStyle } from 'react-native';
import { PieChart } from '@/components/charts';
import { ChartPie, ChevronLeft } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Button, Card, CardHeader, Money, Text } from '@/components/ui';
import { useFitMode } from '@/components/layout/Screen';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { formatShare } from '../components/SliceRow';
import { useSliceColors } from '../sliceColors';
import { useExpenseUi } from '../state/expenseUi';
import type { StatsView } from './useStatsView';

type StatsPieCardProps = {
  view: StatsView;
  active: string | null;
  style?: StyleProp<ViewStyle>;
};

/** The period's split by category, or by subcategory once a category is opened. */
export function StatsPieCard({ view, active, style }: StatsPieCardProps) {
  const theme = useTheme();
  const fit = useFitMode(true);
  // Phones: the pie is width-bound, so a shorter box avoids empty space under it.
  const { isMobile } = useBreakpoint();
  const drillInto = useExpenseUi((state) => state.drillInto);
  const focusSlice = useExpenseUi((state) => state.focusSlice);
  const slices = view.drill ? view.subSlices : view.pie;
  const colors = useSliceColors(slices);
  const noun = view.kind === 'income' ? 'Income' : 'Expenses';
  const title = view.drill ? view.drill.name : `${noun} by category`;
  const total = view.drill ? view.drillTotal : view.total;
  return (
    <Card index={1} style={[{ gap: theme.space[3] }, style]}>
      <CardHeader
        title={title}
        subtitle={view.drill ? `By subcategory · ${view.periodLabel}` : view.periodLabel}
        action={
          view.drill ? (
            <Button
              label="All categories"
              icon={ChevronLeft}
              size="sm"
              variant="secondary"
              onPress={() => drillInto(null)}
            />
          ) : null
        }
      />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space[2] }}>
        <Money
          value={total}
          whole
          variant="figureSm"
          tone={view.kind === 'income' ? 'income' : 'neutral'}
        />
        <Text variant="label" color="textSecondary">
          {view.drill && view.total
            ? `${formatShare(total / view.total)} of ${noun.toLowerCase()}`
            : `${view.ranked.length} ${view.ranked.length === 1 ? 'category' : 'categories'}`}
        </Text>
      </View>
      {slices.length ? (
        <PieChart
          height={fit ? undefined : isMobile ? 240 : 300}
          segments={slices.map((slice, index) => ({
            label: slice.name,
            value: slice.amount,
            color: colors[index],
          }))}
          activeLabel={active ?? view.focus?.name ?? null}
          onSelect={(label) => {
            const slice = slices.find((item) => item.name === label);
            if (!slice) return;
            // In a category, a slice focuses that subcategory; at the top level it opens the category.
            if (view.drill) focusSlice(slice.id);
            else if (slice.category) drillInto(slice.id);
          }}
          accessibilityLabel={`${title}, ${formatMoneyWhole(total)} in ${view.periodLabel}. ${slices
            .slice(0, 4)
            .map((slice) => `${slice.name} ${formatShare(slice.share)}`)
            .join(', ')}.`}
        />
      ) : (
        <EmptyState
          icon={ChartPie}
          title={`No ${noun.toLowerCase()} in ${view.periodLabel}`}
          body="Pick another period or account."
        />
      )}
    </Card>
  );
}
