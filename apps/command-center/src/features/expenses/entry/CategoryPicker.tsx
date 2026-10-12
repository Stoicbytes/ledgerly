import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Plus, Search } from '@/components/icons';
import { Button, Text } from '@/components/ui';
import {
  resolveCategory,
  searchCategories,
  subcategoriesOf,
  topLevelCategories,
  type Category,
  type CategoryKind,
} from '@/lib/domain/expenses';
import { fontFamily, useTheme } from '@/theme';
import { useExpenseStore } from '../state/expenseStore';
import { useExpenseUi } from '../state/expenseUi';
import { CategoryTile } from './CategoryTile';
import { GridRows } from './GridRows';
import { createCategory, NewCategoryForm } from './NewCategory';
import { SubcategoryStrip } from './SubcategoryStrip';

type CategoryPickerProps = {
  kind: CategoryKind;
  selectedId: string | null;
  onChoose: (categoryId: string) => void;
  columns: number;
};

/**
 * Money Manager's category grid: a category with subcategories opens them in
 * place, under its row ("All Food" keeps the parent); search finds both levels.
 */
export function CategoryPicker({ kind, selectedId, onChoose, columns }: CategoryPickerProps) {
  const theme = useTheme();
  const categories = useExpenseStore((state) => state.categories);
  // With subcategories switched off (Categories page), parents are picked directly.
  const withSubcategories = useExpenseUi((state) => state.showSubcategories);
  const selectedParent = resolveCategory(categories, selectedId).parent;
  const [expanded, setExpanded] = useState<string | null>(selectedParent?.id ?? null);
  const [query, setQuery] = useState('');
  // Which "new category" form is open: 'top' for a category, else the parent's id.
  const [creating, setCreating] = useState<string | null>(null);
  const trimmed = query.trim();
  const exactMatch = (list: Category[]) =>
    list.some((item) => item.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
  const createFromSearch = () => {
    const result = createCategory(kind, trimmed, null);
    if ('id' in result) {
      setQuery('');
      onChoose(result.id);
    }
  };
  const created = (id: string) => {
    setCreating(null);
    onChoose(id);
  };
  const parents = useMemo(() => topLevelCategories(categories, kind), [categories, kind]);
  const results = useMemo(
    () =>
      searchCategories(categories, kind, query).filter(
        (category) => withSubcategories || !category.parentId,
      ),
    [categories, kind, query, withSubcategories],
  );
  const parentName = (category: Category) =>
    categories.find((item) => item.id === category.parentId)?.name;
  return (
    <View style={{ gap: theme.space[3] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          height: 34,
          paddingHorizontal: theme.space[3],
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Search size={16} color={theme.colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search categories"
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel="Search categories"
          style={{
            flex: 1,
            color: theme.colors.textPrimary,
            fontFamily: fontFamily.regular,
            fontSize: 14,
            outlineWidth: 0,
          }}
        />
      </View>
      {trimmed ? (
        <View style={{ gap: theme.space[3] }}>
          {results.length ? (
            <GridRows
              items={results}
              columns={columns}
              gap={theme.space[2]}
              keyOf={(category) => category.id}
              render={(category) => (
                <CategoryTile
                  category={category}
                  caption={parentName(category)}
                  selected={category.id === selectedId}
                  onPress={() => onChoose(category.id)}
                />
              )}
            />
          ) : (
            <Text color="textSecondary" align="center" style={{ paddingTop: theme.space[3] }}>
              No category matches “{trimmed}”.
            </Text>
          )}
          {exactMatch(parents) ? null : (
            <View style={{ alignItems: 'center' }}>
              <Button
                label={`Create “${trimmed}”`}
                icon={Plus}
                size="sm"
                variant="ink"
                accessibilityLabel={`Create the ${kind} category ${trimmed} and use it`}
                onPress={createFromSearch}
              />
            </View>
          )}
        </View>
      ) : (
        <>
          <GridRows
            items={parents}
            columns={columns}
            gap={theme.space[2]}
            keyOf={(category) => category.id}
            render={(parent) => {
              const children = withSubcategories
                ? subcategoriesOf(categories, parent.id).length
                : 0;
              return (
                <CategoryTile
                  category={parent}
                  selected={selectedParent?.id === parent.id}
                  expandable={children > 0}
                  expanded={expanded === parent.id}
                  onPress={() =>
                    children
                      ? setExpanded(expanded === parent.id ? null : parent.id)
                      : onChoose(parent.id)
                  }
                />
              );
            }}
            after={(row) => {
              const parent = row.find((item) => item.id === expanded);
              if (!parent) return null;
              return (
                <SubcategoryStrip
                  kind={kind}
                  parent={parent}
                  selectedId={selectedId}
                  creating={creating === parent.id}
                  onCreate={() => setCreating(parent.id)}
                  onCancelCreate={() => setCreating(null)}
                  onCreated={created}
                  onChoose={onChoose}
                />
              );
            }}
          />
          {creating === 'top' ? (
            <NewCategoryForm
              kind={kind}
              parent={null}
              onCreated={created}
              onCancel={() => setCreating(null)}
            />
          ) : (
            <Button
              label={`New ${kind} category`}
              icon={Plus}
              size="sm"
              variant="secondary"
              onPress={() => setCreating('top')}
            />
          )}
        </>
      )}
    </View>
  );
}
