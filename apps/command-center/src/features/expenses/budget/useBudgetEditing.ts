import { useState } from 'react';
import { useToast } from '@/components/feedback';
import type { Category } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useExpenseStore } from '../state/expenseStore';

/** Which category's budget is being edited, and saving it with an Undo toast. */
export function useBudgetEditing() {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const save = (category: Category, budget: number | null) => {
    const previous = category.budget;
    useExpenseStore.getState().setBudget(category.id, budget);
    setEditingId(null);
    toast.show({
      message: budget
        ? `${category.name}: ${formatMoneyWhole(budget)} a month`
        : `Budget removed from ${category.name}`,
      action: {
        label: 'Undo',
        onPress: () => useExpenseStore.getState().setBudget(category.id, previous),
      },
    });
  };
  return { editingId, edit: setEditingId, cancel: () => setEditingId(null), save };
}
