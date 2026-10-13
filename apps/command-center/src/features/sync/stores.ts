import { getLedger, useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { getPortfolio, usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import type { CloudData } from '@/lib/data/ledgerRepository';

/** What the stores hold now, in the shape saved to the cloud. */
export const snapshot = (): CloudData => {
  const { accounts, categories, people, transactions } = getLedger();
  const notes = useNotesStore.getState().notes;
  const { rules, available } = useRecurringStore.getState();
  const recurring = available ? rules : undefined;
  const goalState = useGoalStore.getState();
  const goals = goalState.available ? goalState.goals : undefined;
  const portfolio = getPortfolio();
  const salary = useSalaryStore.getState();
  const { employers, payslips, pfEntries } = salary.available
    ? salary
    : { employers: undefined, payslips: undefined, pfEntries: undefined };
  return {
    accounts,
    categories,
    people,
    transactions,
    notes,
    portfolio,
    recurring,
    goals,
    employers,
    payslips,
    pfEntries,
  };
};

/** Puts loaded cloud data into the stores. */
export function applyToStores(data: CloudData) {
  const {
    notes,
    portfolio,
    recurring,
    goals,
    noteExtras,
    employers,
    payslips,
    pfEntries,
    ...ledger
  } = data;
  useExpenseStore.setState(ledger);
  // Without migration 0012 there is nowhere to keep recurring entries: Repeat is hidden.
  useRecurringStore.setState({ rules: recurring ?? [], available: recurring !== undefined });
  useGoalStore.setState({ goals: goals ?? [], available: goals !== undefined });
  // Without migration 0016 the Salary & PF page is hidden.
  useSalaryStore.setState({
    employers: employers ?? [],
    payslips: payslips ?? [],
    pfEntries: pfEntries ?? [],
    available: employers !== undefined && payslips !== undefined && pfEntries !== undefined,
  });
  // Without migration 0015, deleted notes cannot wait in Recently deleted: delete removes them.
  useNotesStore.setState({ notes, extras: noteExtras === true });
  usePortfolioStore.setState(portfolio);
}

/** Calls `onChange` after any store change; returns the unsubscribers. */
export const subscribeToStores = (onChange: () => void) => [
  useExpenseStore.subscribe(onChange),
  useNotesStore.subscribe(onChange),
  usePortfolioStore.subscribe(onChange),
  useRecurringStore.subscribe(onChange),
  useGoalStore.subscribe(onChange),
  useSalaryStore.subscribe(onChange),
];
