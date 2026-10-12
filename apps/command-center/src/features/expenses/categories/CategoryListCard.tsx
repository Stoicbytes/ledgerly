import { useMemo } from 'react';
import { Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { Plus } from '@/components/icons';
import { Button, Card, SegmentedControl, Text, type Segment } from '@/components/ui';
import {
  entryCounts,
  subcategoriesOf,
  topLevelCategories,
  type CategoryKind,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { useLedger } from '../hooks/useLedger';
import { useExpenseStore } from '../state/expenseStore';
import { useExpenseUi } from '../state/expenseUi';
import { CategoryRow } from './CategoryRow';

const kinds: readonly Segment<CategoryKind>[] = [
  { value: 'expense', label: 'Expense', tone: 'expense' },
  { value: 'income', label: 'Income', tone: 'income' },
];

type CategoryListCardProps = {
  kind: CategoryKind;
  onKind: (kind: CategoryKind) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Money Manager's category settings: one list per kind, a subcategory switch, reorder. */
export function CategoryListCard({
  kind,
  onKind,
  selectedId,
  onSelect,
  onAdd,
  style,
}: CategoryListCardProps) {
  const theme = useTheme();
  const { categories, transactions } = useLedger();
  const moveCategory = useExpenseStore((state) => state.moveCategory);
  const showSubcategories = useExpenseUi((state) => state.showSubcategories);
  const toggleSubcategories = useExpenseUi((state) => state.toggleSubcategories);
  const parents = topLevelCategories(categories, kind);
  const counts = useMemo(() => entryCounts(transactions, categories), [transactions, categories]);
  return (
    <Card index={1} style={[{ gap: theme.space[3] }, style]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          flexWrap: 'wrap',
        }}
      >
        <SegmentedControl
          segments={kinds}
          value={kind}
          onChange={onKind}
          accessibilityLabel="Category type"
          fill={false}
          size="sm"
        />
        <View style={{ flex: 1 }} />
        <Button
          label="Add"
          icon={Plus}
          size="sm"
          variant="ink"
          accessibilityLabel={`Add an ${kind} category`}
          onPress={onAdd}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <View style={{ flex: 1 }}>
          <Text variant="label">Subcategories</Text>
          <Text variant="caption" color="textTertiary">
            {showSubcategories
              ? 'Shown here and offered when adding entries'
              : 'Off: categories are picked without subcategories'}
          </Text>
        </View>
        <Switch
          value={showSubcategories}
          onValueChange={toggleSubcategories}
          accessibilityLabel="Use subcategories"
          trackColor={{ false: theme.colors.borderStrong, true: theme.colors.brandFrom }}
          thumbColor={theme.colors.surface}
        />
      </View>
      <PanelScroll>
        {parents.map((category, index) => (
          <CategoryRow
            key={category.id}
            category={category}
            subcategories={subcategoriesOf(categories, category.id)}
            entries={counts.get(category.id) ?? 0}
            showSubcategories={showSubcategories}
            selected={category.id === selectedId}
            first={index === 0}
            last={index === parents.length - 1}
            onPress={() => onSelect(category.id)}
            onMove={(direction) => moveCategory(category.id, direction)}
          />
        ))}
      </PanelScroll>
    </Card>
  );
}
