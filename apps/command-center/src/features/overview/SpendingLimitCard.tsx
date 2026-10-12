import { Link, type Href } from 'expo-router';
import { View } from 'react-native';
import { Card, CardHeader, CategoryIcon, Money, ProgressBar, Text } from '@/components/ui';
import { iconFor } from '@/features/expenses/categoryIcons';
import type { Slice } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type SpendingLimitCardProps = {
  /** Spent this month in categories that have a budget, and the sum of those budgets. */
  budget: { spent: number; total: number };
  top: Slice[];
  index?: number;
};

/** This month's budget use and the three biggest categories (details on the Budget page). */
export function SpendingLimitCard({ budget, top, index = 6 }: SpendingLimitCardProps) {
  const theme = useTheme();
  const used = budget.total ? budget.spent / budget.total : 0;
  return (
    <Card index={index} style={{ gap: theme.space[4] }}>
      <CardHeader
        title="Monthly budget"
        subtitle={budget.total ? `${Math.round(used * 100)}% used` : 'No budgets set yet'}
        action={
          <Link href={'/dashboard/expenses/budget' as Href} accessibilityLabel="Open budgets">
            <Text variant="label" color="accent">
              Budget
            </Text>
          </Link>
        }
      />
      <View style={{ gap: theme.space[2] }}>
        <ProgressBar
          value={used}
          hatched
          height={14}
          tone={used > 1 ? 'danger' : used > 0.9 ? 'warning' : 'brandFrom'}
          accessibilityLabel="Monthly budget used"
        />
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <Text variant="label" color="textSecondary">
            <Money value={budget.spent} whole variant="bodyStrong" /> spent
          </Text>
          <Text variant="label" color="textSecondary" numeric>
            of {formatMoneyWhole(budget.total)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        {top.map((slice) => (
          <View
            key={slice.id}
            style={{
              flex: 1,
              minWidth: 0,
              gap: 6,
              padding: theme.space[3],
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <CategoryIcon
              icon={iconFor(slice.category?.icon)}
              tint={slice.category?.tint ?? 0}
              size={28}
            />
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {slice.name}
            </Text>
            <Text variant="label" numeric numberOfLines={1}>
              {formatMoneyWhole(slice.amount)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
