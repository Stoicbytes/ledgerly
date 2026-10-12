import { useMemo } from 'react';
import {
  budgetStatus,
  dailyAllowance,
  daysInMonth,
  monthOf,
  todayIso,
} from '@/lib/domain/expenses';
import { useLedger } from '../hooks/useLedger';
import { useExpenseUi } from '../state/expenseUi';

export type MonthState = 'past' | 'current' | 'future';

/**
 * Budgets for the selected month. Budgets cover a category across every
 * account, so the account filter does not apply here.
 */
export function useBudgetView() {
  const { categories, transactions } = useLedger();
  const month = useExpenseUi((state) => state.month);
  return useMemo(() => {
    const status = budgetStatus(categories, transactions, month);
    const today = todayIso();
    const current = monthOf(today);
    const state: MonthState = month === current ? 'current' : month < current ? 'past' : 'future';
    const days = daysInMonth(month);
    const day = Number(today.slice(8));
    const daysLeft = state === 'current' ? days - day + 1 : state === 'future' ? days : 0;
    return {
      ...status,
      month,
      state,
      daysLeft,
      /** Share of the month already gone: where spending "should" be by today. */
      pace: state === 'current' ? day / days : state === 'past' ? 1 : 0,
      allowance: dailyAllowance(status.remaining, daysLeft),
    };
  }, [categories, transactions, month]);
}

export type BudgetView = ReturnType<typeof useBudgetView>;
