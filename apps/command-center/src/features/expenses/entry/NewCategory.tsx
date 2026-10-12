import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@/components/ui';
import {
  MAX_NAME_LENGTH,
  subcategoriesOf,
  topLevelCategories,
  validateName,
  type Category,
  type CategoryKind,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { TextField } from '../components/TextField';
import { useExpenseStore } from '../state/expenseStore';

/**
 * Creates a category while adding an entry. A subcategory takes its parent's
 * icon and colour; a new top-level one gets a neutral icon and the next colour
 * (both can be changed later on the Categories page).
 */
export function createCategory(
  kind: CategoryKind,
  name: string,
  parent: Category | null,
): { id: string } | { error: string } {
  const { categories, saveCategory } = useExpenseStore.getState();
  const siblings = parent
    ? subcategoriesOf(categories, parent.id)
    : topLevelCategories(categories, kind);
  const error = validateName(name, siblings);
  if (error) return { error };
  const created = saveCategory({
    kind,
    parentId: parent?.id ?? null,
    name,
    icon: parent?.icon ?? 'other',
    tint: parent?.tint ?? siblings.length % 8,
    budget: null,
  });
  return { id: created.id };
}

type NewCategoryFormProps = {
  kind: CategoryKind;
  /** Create a subcategory of this category; null for a top-level category. */
  parent: Category | null;
  onCreated: (id: string) => void;
  onCancel: () => void;
};

/** Inline "name + Add" form inside the category picker. */
export function NewCategoryForm({ kind, parent, onCreated, onCancel }: NewCategoryFormProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const result = createCategory(kind, name, parent);
    if ('error' in result) setError(result.error);
    else onCreated(result.id);
  };
  return (
    <View
      style={{
        gap: theme.space[2],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <TextField
        label={parent ? `New subcategory of ${parent.name}` : `New ${kind} category`}
        value={name}
        onChangeText={(next) => {
          setName(next);
          setError(null);
        }}
        onSubmitEditing={add}
        maxLength={MAX_NAME_LENGTH}
        placeholder={parent ? 'e.g. Pizza' : 'e.g. Pets'}
        autoFocus
        error={error}
      />
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        <Button label="Add and use" size="sm" variant="ink" onPress={add} />
        <Button label="Cancel" size="sm" variant="secondary" onPress={onCancel} />
      </View>
      {parent ? null : (
        <Text variant="caption" color="textTertiary">
          Icon, colour and budget can be set later in Expenses › Categories.
        </Text>
      )}
    </View>
  );
}
