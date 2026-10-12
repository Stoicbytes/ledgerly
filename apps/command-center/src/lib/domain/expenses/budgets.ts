import { categoryBreakdown } from './breakdowns';
import { topLevelCategories } from './categories';
import { monthBounds } from './dates';
import type { Category, Transaction } from './types';

export type BudgetLine = {
  category: Category;
  budget: number;
  spent: number;
  remaining: number;
  ratio: number;
};

/** Budget vs spending per top-level expense category for a month. */
export function budgetStatus(
  categories: Category[],
  transactions: Transaction[],
  month: string,
  accountId?: string | null,
) {
  const spentById = new Map(
    categoryBreakdown(transactions, categories, 'expense', monthBounds(month), accountId).map(
      (slice) => [slice.id, slice.amount],
    ),
  );
  const lines: BudgetLine[] = [];
  const unbudgeted: { category: Category; spent: number }[] = [];
  for (const category of topLevelCategories(categories, 'expense')) {
    const spent = spentById.get(category.id) ?? 0;
    if (category.budget && category.budget > 0) {
      lines.push({
        category,
        budget: category.budget,
        spent,
        remaining: category.budget - spent,
        ratio: spent / category.budget,
      });
    } else {
      unbudgeted.push({ category, spent });
    }
  }
  const totalBudget = lines.reduce((sum, line) => sum + line.budget, 0);
  const spentInBudgeted = lines.reduce((sum, line) => sum + line.spent, 0);
  return {
    lines: lines.sort((a, b) => b.ratio - a.ratio),
    unbudgeted: unbudgeted.sort((a, b) => b.spent - a.spent),
    totalBudget,
    spentInBudgeted,
    remaining: totalBudget - spentInBudgeted,
  };
}

/** Even daily allowance for the rest of the month (null when nothing is left). */
export function dailyAllowance(remaining: number, daysLeft: number): number | null {
  if (remaining <= 0 || daysLeft <= 0) return null;
  return Math.floor(remaining / daysLeft);
}
