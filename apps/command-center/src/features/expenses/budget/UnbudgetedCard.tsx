import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Button, Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import type { Category } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { iconFor } from '../categoryIcons';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { BudgetEditor } from './BudgetEditor';
import type { BudgetView } from './useBudgetView';
import type { useBudgetEditing } from './useBudgetEditing';

type UnbudgetedCardProps = {
  view: BudgetView;
  editing: ReturnType<typeof useBudgetEditing>;
  style?: StyleProp<ViewStyle>;
};

/** Categories without a budget, those with spending this month first. */
export function UnbudgetedCard({ view, editing, style }: UnbudgetedCardProps) {
  const theme = useTheme();
  return (
    <Card index={2} style={[{ gap: theme.space[2] }, style]}>
      <CardHeader title="Without a budget" subtitle={`${view.unbudgeted.length} categories`} />
      <PanelScroll gap={0}>
        {view.unbudgeted.map(({ category, spent }) => (
          <UnbudgetedRow
            key={category.id}
            category={category}
            spent={spent}
            editing={editing.editingId === category.id}
            onEdit={() => editing.edit(category.id)}
            onSave={(budget) => editing.save(category, budget)}
            onCancel={editing.cancel}
          />
        ))}
      </PanelScroll>
    </Card>
  );
}

type UnbudgetedRowProps = {
  category: Category;
  spent: number;
  editing: boolean;
  onEdit: () => void;
  onSave: (budget: number | null) => void;
  onCancel: () => void;
};

function UnbudgetedRow({ category, spent, editing, onEdit, onSave, onCancel }: UnbudgetedRowProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        gap: theme.space[2],
        paddingVertical: theme.space[2],
        paddingHorizontal: theme.space[1],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <CategoryIcon icon={iconFor(category.icon)} tint={category.tint} size={32} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="label" numberOfLines={1}>
            {category.name}
          </Text>
          <Text variant="caption" color="textTertiary" numeric>
            {spent ? `${formatMoneyWhole(spent)} spent` : 'Nothing spent'}
          </Text>
        </View>
        {editing ? null : (
          <Button
            label="Set budget"
            size="sm"
            variant="secondary"
            accessibilityLabel={`Set a budget for ${category.name}`}
            onPress={onEdit}
          />
        )}
      </View>
      {editing ? (
        <BudgetEditor name={category.name} value={null} onSave={onSave} onCancel={onCancel} />
      ) : null}
    </View>
  );
}
