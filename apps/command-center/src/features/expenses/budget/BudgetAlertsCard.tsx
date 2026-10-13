import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CircleAlert, Gauge } from '@/components/icons';
import { Card, CardHeader, Text } from '@/components/ui';
import { alertText } from '@/features/overview/budgetInsight';
import { budgetAlerts } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { useLedger } from '../hooks/useLedger';
import type { BudgetView } from './useBudgetView';

/** This month's budgets that are over, nearly used up, or on course to be passed. */
export function BudgetAlertsCard({
  view,
  today,
  style,
}: {
  view: BudgetView;
  today: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { categories, transactions } = useLedger();
  if (view.state !== 'current') return null;
  const alerts = budgetAlerts(categories, transactions, today);
  if (!alerts.length) return null;
  return (
    <Card index={1} style={[{ gap: theme.space[3] }, style]}>
      <CardHeader
        title="Budget alerts"
        subtitle="Over, 80% used, or on course to pass by month-end."
      />
      {alerts.map((alert) => {
        const Icon = alert.level === 'pace' ? Gauge : CircleAlert;
        const color = alert.level === 'over' ? theme.colors.danger : theme.colors.warning;
        return (
          <View key={alert.category.id} style={{ flexDirection: 'row', gap: theme.space[2] }}>
            <Icon size={18} color={color} />
            <Text style={{ flex: 1 }}>{alertText(alert)}</Text>
          </View>
        );
      })}
    </Card>
  );
}
