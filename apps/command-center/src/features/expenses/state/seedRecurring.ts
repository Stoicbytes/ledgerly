import { monthOf, todayIso, type RecurringEntry } from '@/lib/domain/expenses';

/** One sample rule for the preview: rent on the 1st, due this month. */
export const seedRules = (): RecurringEntry[] => {
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
