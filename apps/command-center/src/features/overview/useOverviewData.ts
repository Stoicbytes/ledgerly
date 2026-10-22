import { useMemo } from 'react';
import { comparisonLabel } from '@/features/expenses/format';
import { useLedger } from '@/features/expenses/hooks/useLedger';
import { useFundsView, useStocksView } from '@/features/investments/hooks/useInvestments';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import {
  accountBalances,
  budgetStatus,
  comparisonRange,
  inRange,
  monthBounds,
  monthLabel,
  monthOf,
  percentChange,
  periodTotals,
  netWorthAccounts,
  todayIso,
} from '@/lib/domain/expenses';
import { monthTotals, netWorthHistory, spendingMix } from '@/lib/domain/insights';
import { pfBalance } from '@/lib/domain/salary';
import { cardDue, monthPulse, overviewInsights } from './insights';

/**
 * Overview figures. Cash flow, spending and accounts come from the expense ledger,
 * funds and stocks from the investment pages, PF from Salary & PF (the same numbers in
 * both places).
 */
export function useOverviewData() {
  const { accounts, categories, transactions } = useLedger();
  const fundsView = useFundsView();
  const stocksView = useStocksView();
  const pfEntries = useSalaryStore((state) => state.pfEntries);
  const payslips = useSalaryStore((state) => state.payslips);
  const employers = useSalaryStore((state) => state.employers);
  const rules = useRecurringStore((state) => state.rules);
  const tracksFunds = usePortfolioStore((state) => state.funds.length > 0);
  const tracksStocks = usePortfolioStore((state) => state.stocks.length > 0);
  return useMemo(() => {
    const today = todayIso();
    const tracking = { funds: tracksFunds, stocks: tracksStocks };
    const month = monthOf(today);
    const range = monthBounds(month);
    const totals = periodTotals(transactions, range);
    const baseRange = comparisonRange(month, today);
    const base = periodTotals(transactions, baseRange);
    const balances = accountBalances(accounts, transactions);
    const investmentIds = new Set(
      accounts.filter((account) => account.group === 'investment').map((account) => account.id),
    );
    // Savings & investments accounts count (PPF, FD), except fund and share accounts whose
    // worth is the holdings' market value below. Credit cards stay out (you asked for it):
    // what they are owed is shown as an insight instead.
    const { shown, leftOut, cash } = netWorthAccounts(accounts, balances, tracking);
    const funds = fundsView.totals;
    const stocks = stocksView.totals;
    // Credited PF only (your share and the employer's); the pension share is not a balance.
    const pf = pfBalance(pfEntries).total;
    const budget = budgetStatus(categories, transactions, month);
    const insightInput = {
      today,
      transactions,
      categories,
      accounts,
      balances,
      rules,
      payslips,
      pfEntries,
      employers,
    };
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
      netWorth: cash + funds.value + stocks.value + pf,
      pf,
      cardDue: cardDue(accounts, balances),
      insights: overviewInsights(insightInput),
      pulse: monthPulse(insightInput),
      accounts: shown,
      /** Accounts whose worth is counted as fund or share value instead. */
      leftOut: leftOut.map((account) => account.name),
      flow: monthTotals(transactions, month, 8).map((item) => ({
        ...item,
        label: monthLabel(item.month, 'short'),
        projected: item.month === month,
      })),
      budget: { spent: budget.spentInBudgeted, total: budget.totalBudget },
      spending: spendingMix(transactions, categories, today),
      /** Month-end net worth, counted as today (see netWorthHistory). */
      trend: netWorthHistory({
        accounts,
        transactions,
        tracking,
        pfEntries,
        months: fundsView.series.months,
        funds: fundsView.series.value,
        stocks: stocksView.series.value,
      }),
      recent: sorted.slice(0, 6),
      funds: { ...funds, series: held(fundsView.series.value) },
      stocks: { ...stocks, series: held(stocksView.series.value) },
    };
  }, [
    accounts,
    categories,
    transactions,
    fundsView,
    stocksView,
    pfEntries,
    payslips,
    employers,
    rules,
    tracksFunds,
    tracksStocks,
  ]);
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
