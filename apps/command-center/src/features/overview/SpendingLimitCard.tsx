import { Link, type Href } from 'expo-router';
import { View } from 'react-native';
import { Card, CardHeader, Money, ProgressBar, Text } from '@/components/ui';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type SpendingLimitCardProps = {
  /** Spent this month in categories that have a budget, and the sum of those budgets. */
  budget: { spent: number; total: number };
  index?: number;
};

/** This month's budget use (details on the Budget page; categories are in Spending by category). */
export function SpendingLimitCard({ budget, index = 6 }: SpendingLimitCardProps) {
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
    </Card>
  );
}
