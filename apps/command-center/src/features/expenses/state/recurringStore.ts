import { create } from 'zustand';
import { monthOf, todayIso, type RecurringEntry } from '@/lib/domain/expenses';

type RecurringState = {
  rules: RecurringEntry[];
  /** False while signed in to a database without migration 0012: Repeat is hidden. */
  available: boolean;
  resetPreview: () => void;
};

/** One sample rule for the preview: rent on the 1st, due this month. */
const seedRules = (): RecurringEntry[] => {
  const first = `${monthOf(todayIso())}-01`;
  return [
    {
      id: 'rec-rent',
      kind: 'expense',
      amount: 14_000_00,
      accountId: 'acc-main',
      toAccountId: null,
      fee: 0,
      categoryId: 'expense-rent',
      note: 'Rent',
      frequency: 'monthly',
      startDate: first,
      nextDate: first,
      createdAt: 0,
    },
  ];
};

/** Recurring entries (rent, subscriptions, EMIs); changes go through recurringActions. */
export const useRecurringStore = create<RecurringState>((set) => ({
  rules: seedRules(),
  available: true,
  resetPreview: () => set({ rules: seedRules(), available: true }),
}));
