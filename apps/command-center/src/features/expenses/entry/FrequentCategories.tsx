import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { frequentCategories, todayIso, type CategoryKind } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { useExpenseStore } from '../state/expenseStore';
import { CategoryTile } from './CategoryTile';
import { GridRows } from './GridRows';

type FrequentCategoriesProps = {
  kind: CategoryKind;
  selectedId: string | null;
  withSubcategories: boolean;
  columns: number;
  onChoose: (categoryId: string) => void;
};

/** The 4–6 categories used most in the last 90 days, one tap away above the grid. */
export function FrequentCategories({
  kind,
  selectedId,
  withSubcategories,
  columns,
  onChoose,
}: FrequentCategoriesProps) {
  const theme = useTheme();
  const transactions = useExpenseStore((state) => state.transactions);
  const categories = useExpenseStore((state) => state.categories);
  const frequent = useMemo(
    () => frequentCategories(transactions, categories, kind, todayIso(), { withSubcategories }),
    [transactions, categories, kind, withSubcategories],
  );
  if (!frequent.length) return null;
  const parentName = (parentId: string | null) =>
    categories.find((item) => item.id === parentId)?.name;
  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="caption" color="textSecondary">
        Used most
      </Text>
      <GridRows
        items={frequent}
        columns={columns}
        gap={theme.space[2]}
        keyOf={(category) => `frequent-${category.id}`}
        render={(category) => (
          <CategoryTile
            category={category}
            caption={parentName(category.parentId)}
            selected={category.id === selectedId}
            onPress={() => onChoose(category.id)}
          />
        )}
      />
      <Text variant="caption" color="textSecondary">
        All categories
      </Text>
    </View>
  );
}
