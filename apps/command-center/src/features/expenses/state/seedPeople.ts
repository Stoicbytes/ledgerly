import type { Person, Transaction } from '@/lib/domain/expenses';

/** Fictional sample people for the preview (labelled sample data). */
export const seedPeople = (): Person[] => [
  { id: 'person-arun', name: 'Arun', order: 0 },
  { id: 'person-meera', name: 'Meera', order: 1 },
];

const SHARED = ['expense-social-life--friends-outing', 'expense-food--biriyani'];

/**
 * Marks the two most recent shared-looking expenses as split, so the People page has
 * something to show: one shared three ways, one where Arun owes half.
 */
export function withSampleSplits(transactions: Transaction[]): Transaction[] {
  const shared = transactions
    .filter((item) => item.kind === 'expense' && SHARED.includes(item.categoryId ?? ''))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2);
  const [outing, meal] = shared;
  return transactions.map((item) => {
    if (outing && item.id === outing.id) {
      const share = Math.floor(item.amount / 3);
      return {
        ...item,
        splits: [
          { personId: 'person-arun', amount: share },
          { personId: 'person-meera', amount: share },
        ],
      };
    }
    if (meal && item.id === meal.id) {
      return {
        ...item,
        splits: [{ personId: 'person-arun', amount: Math.floor(item.amount / 2) }],
      };
    }
    return item;
  });
}
