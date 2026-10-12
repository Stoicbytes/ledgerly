import { useMemo } from 'react';
import {
  accountBalance,
  balanceSummary,
  calendarMonth,
  comparisonRange,
  groupByDay,
  monthBounds,
  monthOf,
  percentChange,
  periodTotals,
  todayIso,
} from '@/lib/domain/expenses';
import { comparisonLabel } from '../format';
import { useExpenseUi } from '../state/expenseUi';
import { useLedger } from './useLedger';

/** Everything the Transactions views need for the selected month and account filter. */
export function useMonthView() {
  const { accounts, transactions } = useLedger();
  const month = useExpenseUi((state) => state.month);
  const accountId = useExpenseUi((state) => state.accountId);
  const selectedDate = useExpenseUi((state) => state.selectedDate);
  return useMemo(() => {
    const today = todayIso();
    const range = monthBounds(month);
    const totals = periodTotals(transactions, range, accountId);
    const base = comparisonRange(month, today);
    const previous = periodTotals(transactions, base, accountId);
    const account = accounts.find((item) => item.id === accountId) ?? null;
    const groups = groupByDay(transactions, range, accountId);
    const focusDay =
      selectedDate && monthOf(selectedDate) === month
        ? selectedDate
        : monthOf(today) === month
          ? today
          : (groups[0]?.date ?? range.start);
    return {
      month,
      range,
      today,
      accountId,
      account,
      totals,
      groups,
      focusDay,
      weeks: calendarMonth(month, transactions, accountId),
      balance: account
        ? accountBalance(account, transactions, range.end)
        : balanceSummary(accounts, transactions, range.end).total,
      comparison: comparisonLabel(base, month, today),
      deltas: {
        income: percentChange(totals.income, previous.income),
        expense: percentChange(totals.expense, previous.expense),
      },
    };
  }, [accounts, transactions, month, accountId, selectedDate]);
}
