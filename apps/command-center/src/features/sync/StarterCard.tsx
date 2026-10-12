import { View } from 'react-native';
import { Button, Card, Text } from '@/components/ui';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useTheme } from '@/theme';
import { addStarterLedger } from './starter';
import { useSyncStatus } from './syncStatus';

/** Shown once a signed-in user's ledger is empty: a one-tap starting point. */
export function StarterCard() {
  const theme = useTheme();
  const saved = useSyncStatus((state) => state.status !== 'off' && state.status !== 'loading');
  const empty = useExpenseStore(
    (state) => state.categories.length === 0 && state.accounts.length === 0,
  );
  if (!saved || !empty) return null;
  return (
    <Card style={{ gap: theme.space[3] }}>
      <Text variant="bodyStrong">Your ledger is empty</Text>
      <Text color="textSecondary">
        Start with the usual expense and income categories and a Cash account. You can rename,
        remove or add more at any time.
      </Text>
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label="Add starter categories" onPress={addStarterLedger} />
      </View>
    </Card>
  );
}
