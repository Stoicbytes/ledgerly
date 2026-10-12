import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Card, Money, ProgressRing, Text } from '@/components/ui';
import { monthLabel } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import type { BudgetView } from './useBudgetView';

/** Overall budget for the month: spent, left, and an even daily allowance. */
export function BudgetHero({ view, style }: { view: BudgetView; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const used = view.totalBudget ? view.spentInBudgeted / view.totalBudget : 0;
  const over = view.remaining < 0;
  const footnote =
    view.state === 'past'
      ? over
        ? `Finished ${formatMoneyWhole(-view.remaining)} over budget`
        : `Finished ${formatMoneyWhole(view.remaining)} under budget`
      : over
        ? `${formatMoneyWhole(-view.remaining)} over budget`
        : view.allowance !== null
          ? `${formatMoneyWhole(view.allowance)} a day for the ${view.daysLeft} days left`
          : 'Nothing left to spend this month';
  return (
    <Card variant="brand" index={0} style={[{ gap: theme.space[4] }, style]}>
      <Text variant="eyebrow" color="onBrandMuted" uppercase>
        {monthLabel(view.month)} budget
      </Text>
      {view.totalBudget ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[5] }}>
          <ProgressRing
            value={used}
            size={112}
            strokeWidth={11}
            tone={over ? 'warning' : 'onBrand'}
            accessibilityLabel="Budget used"
          >
            <Text variant="title" color="onBrand" numeric>
              {Math.round(used * 100)}%
            </Text>
            <Text variant="caption" color="onBrandMuted">
              used
            </Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: theme.space[1] }}>
            <Text variant="label" color="onBrandMuted">
              Spent
            </Text>
            <Money
              value={view.spentInBudgeted}
              whole
              animate
              variant="figure"
              color="onBrand"
              numberOfLines={1}
            />
            <Text variant="label" color="onBrandMuted" numeric>
              of {formatMoneyWhole(view.totalBudget)} across {view.lines.length} categories
            </Text>
          </View>
        </View>
      ) : (
        <Text variant="bodyLg" color="onBrand">
          No budgets yet. Give a category a monthly amount to track it here.
        </Text>
      )}
      {view.totalBudget ? (
        <View
          style={{
            paddingVertical: theme.space[2],
            paddingHorizontal: theme.space[3],
            borderRadius: theme.radius.md,
            backgroundColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <Text variant="bodyStrong" color="onBrand">
            {over ? 'Over budget' : `${formatMoneyWhole(view.remaining)} left`}
          </Text>
          <Text variant="label" color="onBrandMuted">
            {footnote}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
