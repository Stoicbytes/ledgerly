import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Trash2 } from '@/components/icons';
import { Button, CategoryIcon, IconButton, Text } from '@/components/ui';
import {
  amountToInput,
  MAX_NAME_LENGTH,
  parseLimitedAmount,
  topLevelCategories,
  validateName,
  type Category,
  type CategoryKind,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { iconFor } from '../categoryIcons';
import { TextField } from '../components/TextField';
import { useLedger } from '../hooks/useLedger';
import { useExpenseStore } from '../state/expenseStore';
import { useExpenseUi } from '../state/expenseUi';
import { AppearancePicker } from './AppearancePicker';
import { SubcategoryList } from './SubcategoryList';

type CategoryEditorProps = {
  /** The category being edited, or null to create one of `kind`. */
  category: Category | null;
  kind: CategoryKind;
  onSaved: (id: string) => void;
  onDelete: () => void;
  onCancel?: () => void;
};

/** Name, colour, icon, monthly budget and subcategories of a top-level category. */
export function CategoryEditor({
  category,
  kind,
  onSaved,
  onDelete,
  onCancel,
}: CategoryEditorProps) {
  const theme = useTheme();
  const toast = useToast();
  const { categories } = useLedger();
  const withSubcategories = useExpenseUi((state) => state.showSubcategories);
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'other');
  const [tint, setTint] = useState(category?.tint ?? 0);
  const [budgetText, setBudgetText] = useState(
    category?.budget ? amountToInput(category.budget) : '',
  );
  const [errors, setErrors] = useState<{ name?: string; budget?: string }>({});
  const budgeted = kind === 'expense';
  const save = () => {
    const nameError = validateName(name, topLevelCategories(categories, kind), category?.id);
    const budget = budgetText.trim() ? parseLimitedAmount(budgetText) : null;
    const budgetError =
      budgetText.trim() && budget === null
        ? 'Enter a monthly amount like 5,000, or leave it empty.'
        : undefined;
    if (nameError || budgetError)
      return setErrors({ name: nameError ?? undefined, budget: budgetError });
    const saved = useExpenseStore
      .getState()
      .saveCategory(
        { kind, parentId: null, name, icon, tint, budget: budgeted ? budget : null },
        category?.id,
      );
    toast.show({ message: category ? `${saved.name} saved` : `${saved.name} added` });
    onSaved(saved.id);
  };
  return (
    <View style={{ gap: theme.space[5] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <CategoryIcon icon={iconFor(icon)} tint={tint} size={52} />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>
            {name.trim() || (category ? category.name : `New ${kind} category`)}
          </Text>
          <Text variant="label" color="textSecondary">
            {kind === 'expense' ? 'Expense category' : 'Income category'}
          </Text>
        </View>
        {category ? (
          <IconButton
            icon={Trash2}
            tone="danger"
            variant="muted"
            tooltip="top"
            accessibilityLabel={`Delete ${category.name}`}
            onPress={onDelete}
          />
        ) : null}
        {onCancel ? (
          <Button label="Cancel" variant="secondary" size="sm" onPress={onCancel} />
        ) : null}
        <Button label={category ? 'Save' : 'Add'} size="sm" onPress={save} />
      </View>
      <TextField
        label="Name"
        value={name}
        onChangeText={(next) => {
          setName(next);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        maxLength={MAX_NAME_LENGTH}
        placeholder="e.g. Groceries"
        error={errors.name}
        onSubmitEditing={save}
      />
      {budgeted ? (
        <TextField
          label="Monthly budget"
          money
          value={budgetText}
          onChangeText={(next) => {
            setBudgetText(next);
            setErrors((current) => ({ ...current, budget: undefined }));
          }}
          placeholder="No budget"
          hint="Tracked on the Budget page. Leave empty for none."
          error={errors.budget}
        />
      ) : null}
      <AppearancePicker icon={icon} tint={tint} onIcon={setIcon} onTint={setTint} />
      {category && withSubcategories ? <SubcategoryList parent={category} /> : null}
    </View>
  );
}
