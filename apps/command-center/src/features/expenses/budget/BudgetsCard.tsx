import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Target } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Card, CardHeader, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { BudgetLineRow } from './BudgetLineRow';
import type { BudgetView } from './useBudgetView';
import type { useBudgetEditing } from './useBudgetEditing';

type BudgetsCardProps = {
  view: BudgetView;
  editing: ReturnType<typeof useBudgetEditing>;
  style?: StyleProp<ViewStyle>;
};

/** Budgeted categories, most used first. The dark mark on each bar is today. */
export function BudgetsCard({ view, editing, style }: BudgetsCardProps) {
  const theme = useTheme();
  return (
    <Card index={1} style={[{ gap: theme.space[2] }, style]}>
      <CardHeader
        title="Category budgets"
        subtitle={
          view.state === 'current'
            ? 'The dark mark shows how much of the month has passed'
            : undefined
        }
      />
      {view.lines.length ? (
        <PanelScroll gap={0}>
          {view.lines.map((line) => (
            <BudgetLineRow
              key={line.category.id}
              line={line}
              pace={view.pace}
              editing={editing.editingId === line.category.id}
              onEdit={() => editing.edit(line.category.id)}
              onSave={(budget) => editing.save(line.category, budget)}
              onCancel={editing.cancel}
            />
          ))}
        </PanelScroll>
      ) : (
        <View>
          <EmptyState
            icon={Target}
            title="No budgets yet"
            body="Set a monthly amount on any category below to see how spending keeps up."
          />
          <Text variant="caption" color="textTertiary" align="center">
            Budgets apply to top-level expense categories, across all accounts.
          </Text>
        </View>
      )}
    </Card>
  );
}
