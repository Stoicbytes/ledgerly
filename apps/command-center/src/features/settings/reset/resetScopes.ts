import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import type { ResetScope } from '@/lib/data/resetRepository';

export type ResetOption = {
  scope: ResetScope;
  title: string;
  detail: string;
  /** What would be deleted now, e.g. "1,210 entries and 3 recurring entries". */
  summary: () => string;
  /** Preview mode: clear the sample data in memory (signed in, the database does it). */
  clearLocally: () => void;
};

const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
const list = (parts: string[]) =>
  parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];

const expenses = () => useExpenseStore.getState();
const portfolio = () => usePortfolioStore.getState();

export const RESET_OPTIONS: readonly ResetOption[] = [
  {
    scope: 'expense_entries',
    title: 'Expense entries',
    detail:
      'Every income, expense and transfer, and recurring entries. Accounts, categories, budgets and people stay.',
    summary: () =>
      list([
        count(expenses().transactions.length, 'entry', 'entries'),
        count(useRecurringStore.getState().rules.length, 'recurring entry', 'recurring entries'),
      ]),
    clearLocally: () => {
      const { accounts, categories, people } = expenses();
      expenses().restoreLedger({ accounts, categories, people, transactions: [] });
      useRecurringStore.setState({ rules: [] });
    },
  },
  {
    scope: 'expenses_all',
    title: 'Everything in Expenses',
    detail:
      'Entries and recurring entries, plus accounts, categories, budgets and people. Start again from the starter set.',
    summary: () =>
      list([
        count(expenses().transactions.length, 'entry', 'entries'),
        count(expenses().accounts.length, 'account'),
        count(expenses().categories.length, 'category', 'categories'),
        count(expenses().people.length, 'person', 'people'),
      ]),
    clearLocally: () => {
      expenses().restoreLedger({ accounts: [], categories: [], people: [], transactions: [] });
      useRecurringStore.setState({ rules: [] });
    },
  },
  {
    scope: 'mutual_funds',
    title: 'Mutual funds',
    detail: 'Every fund with its transactions and SIPs, and your goals.',
    summary: () =>
      list([
        count(portfolio().funds.length, 'fund'),
        count(portfolio().fundTxns.length, 'transaction'),
        count(portfolio().sips.length, 'SIP'),
        count(useGoalStore.getState().goals.length, 'goal'),
      ]),
    clearLocally: () => {
      usePortfolioStore.setState({ funds: [], fundTxns: [], sips: [] });
      useGoalStore.setState({ goals: [] });
    },
  },
  {
    scope: 'stocks',
    title: 'Stocks',
    detail:
      'Every share with its trades, splits, bonuses and dividends. Your chosen benchmark stays.',
    summary: () =>
      list([count(portfolio().stocks.length, 'share'), count(portfolio().trades.length, 'trade')]),
    clearLocally: () => usePortfolioStore.setState({ stocks: [], trades: [] }),
  },
];
