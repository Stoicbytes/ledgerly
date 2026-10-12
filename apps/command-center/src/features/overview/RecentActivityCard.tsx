import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, CardHeader } from '@/components/ui';
import { LedgerRow } from '@/features/expenses/components/LedgerRow';
import type { Transaction } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';

/** Latest entries from the expense manager; pressing one opens it for editing. */
export function RecentActivityCard({
  transactions,
  index = 9,
}: {
  transactions: Transaction[];
  index?: number;
}) {
  const theme = useTheme();
  return (
    <Card index={index} style={{ gap: theme.space[2], flex: 1 }}>
      <CardHeader
        title="Recent activity"
        subtitle="Latest income, expenses and transfers"
        action={
          <Button
            label="View all"
            variant="secondary"
            size="sm"
            onPress={() => router.push('/dashboard/expenses' as Href)}
          />
        }
      />
      <View>
        {transactions.map((transaction) => (
          <LedgerRow key={transaction.id} transaction={transaction} showDate />
        ))}
      </View>
    </Card>
  );
}
