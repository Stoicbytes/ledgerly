import { useMemo } from 'react';
import { comparisonLabel } from '@/features/expenses/format';
import { useLedger } from '@/features/expenses/hooks/useLedger';
import { useFundsView, useStocksView } from '@/features/investments/hooks/useInvestments';
import {
  accountBalances,
  budgetStatus,
  categoryBreakdown,
  comparisonRange,
  inRange,
  monthBounds,
  monthLabel,
  monthlySeries,
  monthOf,
  percentChange,
  periodTotals,
  sortAccounts,
  todayIso,
} from '@/lib/domain/expenses';

/**
 * Overview figures. Cash flow, spending and accounts come from the expense ledger,
 * funds and stocks from the investment pages (the same numbers in both places).
 */
export function useOverviewData() {
  const { accounts, categories, transactions } = useLedger();
  const fundsView = useFundsView();
  const stocksView = useStocksView();
  return useMemo(() => {
    const today = todayIso();
    const month = monthOf(today);
    const range = monthBounds(month);
    const totals = periodTotals(transactions, range);
    const baseRange = comparisonRange(month, today);
    const base = periodTotals(transactions, baseRange);
    const balances = accountBalances(accounts, transactions);
    const investmentIds = new Set(
      accounts.filter((account) => account.group === 'investment').map((account) => account.id),
    );
    // Investment accounts record the money moved in (cost); their worth is the
    // holdings' market value below, so they are left out here to avoid counting twice.
    const everyday = sortAccounts(accounts)
      .filter((account) => !investmentIds.has(account.id))
      .map((account) => ({ account, balance: balances.get(account.id) ?? 0 }));
    const cash = everyday.reduce((sum, item) => sum + item.balance, 0);
    const funds = fundsView.totals;
    const stocks = stocksView.totals;
    const budget = budgetStatus(categories, transactions, month);
    const sorted = [...transactions].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
    );
    return {
      income: totals.income,
      expense: totals.expense,
      savings: totals.net,
      comparison: comparisonLabel(baseRange, month, today),
      incomeDelta: percentChange(totals.income, base.income),
      expenseDelta: percentChange(totals.expense, base.expense),
      /** This month's transfers into investment accounts (SIPs). */
      invested: transactions
        .filter((item) => item.kind === 'transfer' && inRange(item, range))
        .filter((item) => item.toAccountId !== null && investmentIds.has(item.toAccountId))
        .reduce((sum, item) => sum + item.amount, 0),
      netWorth: cash + funds.value + stocks.value,
      accounts: everyday,
      flow: monthlySeries(month, 8, transactions).map((item) => ({
        ...item,
        label: monthLabel(item.month, 'short'),
        projected: item.month === month,
      })),
      budget: { spent: budget.spentInBudgeted, total: budget.totalBudget },
      topCategories: categoryBreakdown(transactions, categories, 'expense', range).slice(0, 3),
      recent: sorted.slice(0, 6),
      funds: { ...funds, series: held(fundsView.series.value) },
      stocks: { ...stocks, series: held(stocksView.series.value) },
    };
  }, [accounts, categories, transactions, fundsView, stocksView]);
}

/** Drops the months before anything was held, so the sparkline starts at the first value. */
const held = (values: number[]) =>
  values.slice(
    Math.max(
      0,
      values.findIndex((value) => value > 0),
    ),
  );

export type OverviewData = ReturnType<typeof useOverviewData>;
