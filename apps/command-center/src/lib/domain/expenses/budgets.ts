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

export type BudgetAlert = {
  category: Category;
  /** over: past the budget; near: 80% or more used (all of it included); pace: on course to pass it. */
  level: 'over' | 'near' | 'pace';
  spent: number;
  budget: number;
  /** Month-end spending at this month's daily rate. */
  projected: number;
};

const ALERT_ORDER = { over: 0, near: 1, pace: 2 } as const;

/**
 * Budgets that need attention this month (as of `today`), most urgent first. "On course"
 * needs a week of the month, so one early purchase does not raise an alarm.
 */
export function budgetAlerts(
  categories: Category[],
  transactions: Transaction[],
  today: string,
): BudgetAlert[] {
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const days = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const alerts: BudgetAlert[] = [];
  for (const line of budgetStatus(categories, transactions, month).lines) {
    const projected = Math.round((line.spent / Math.max(day, 1)) * days);
    const level =
      line.spent > line.budget
        ? 'over'
        : line.ratio >= 0.8
          ? 'near'
          : day >= 7 && projected > line.budget
            ? 'pace'
            : null;
    if (level) {
      alerts.push({
        category: line.category,
        level,
        spent: line.spent,
        budget: line.budget,
        projected,
      });
    }
  }
  return alerts.sort(
    (a, b) =>
      ALERT_ORDER[a.level] - ALERT_ORDER[b.level] || b.spent / b.budget - a.spent / a.budget,
  );
}
