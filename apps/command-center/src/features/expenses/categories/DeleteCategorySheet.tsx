import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, CategoryIcon, Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import {
  entryCounts,
  subcategoriesOf,
  topLevelCategories,
  type Category,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { iconFor } from '../categoryIcons';
import { useLedger } from '../hooks/useLedger';
import { useExpenseStore } from '../state/expenseStore';

type DeleteCategorySheetProps = {
  category: Category | null;
  onClose: () => void;
  onDeleted: () => void;
};

/**
 * Deleting a category asks where its entries go (another category of the same
 * kind, or Uncategorized) and can be undone (EXPENSE_MANAGER_FLOW.md rule 6).
 */
export function DeleteCategorySheet({ category, onClose, onDeleted }: DeleteCategorySheetProps) {
  const theme = useTheme();
  const toast = useToast();
  const { categories, transactions } = useLedger();
  const [target, setTarget] = useState<string | null>(null);
  const counts = useMemo(() => entryCounts(transactions, categories), [transactions, categories]);
  if (!category) return null;
  const entries = counts.get(category.id) ?? 0;
  const subs = subcategoriesOf(categories, category.id).length;
  const others = topLevelCategories(categories, category.kind).filter(
    (item) => item.id !== category.id,
  );
  const confirm = () => {
    const previous = useExpenseStore.getState().deleteCategory(category.id, target);
    const destination = others.find((item) => item.id === target)?.name ?? 'Uncategorized';
    toast.show({
      message: `${category.name} deleted${entries ? ` · entries moved to ${destination}` : ''}`,
      action: { label: 'Undo', onPress: () => useExpenseStore.getState().restoreLedger(previous) },
    });
    onDeleted();
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Delete ${category.name}?`}
      width={480}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label={`Delete ${category.name}`} variant="danger" onPress={confirm} />
        </>
      }
    >
      <View style={{ gap: theme.space[3] }}>
        <Text color="textSecondary">
          {entries
            ? `${entries} ${entries === 1 ? 'entry uses' : 'entries use'} ${category.name}${subs ? ` or its ${subs} subcategories` : ''}. Where should ${entries === 1 ? 'it' : 'they'} go?`
            : `Nothing is recorded under ${category.name}${subs ? `; its ${subs} subcategories go too` : ''}.`}
        </Text>
        {entries ? (
          <View role="radiogroup" accessibilityLabel="Move entries to" style={{ gap: 2 }}>
            <Option
              label="Leave uncategorized"
              selected={target === null}
              onPress={() => setTarget(null)}
            />
            {others.map((item) => (
              <Option
                key={item.id}
                label={item.name}
                category={item}
                selected={target === item.id}
                onPress={() => setTarget(item.id)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

type OptionProps = { label: string; category?: Category; selected: boolean; onPress: () => void };

function Option({ label, category, selected, onPress }: OptionProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...handlers}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          padding: theme.space[2],
          borderRadius: theme.radius.md,
          backgroundColor: selected
            ? theme.colors.primarySoft
            : hovered
              ? theme.colors.surfaceMuted
              : 'transparent',
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <View
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: selected ? theme.colors.ink : theme.colors.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? (
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.ink }}
          />
        ) : null}
      </View>
      {category ? (
        <CategoryIcon icon={iconFor(category.icon)} tint={category.tint} size={28} />
      ) : null}
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}
