import { budgetAlerts, type Category, type Transaction } from '..';
import { alertText, budgetInsight } from '@/features/overview/budgetInsight';

const category = (
  id: string,
  name: string,
  budget: number | null,
  parentId: string | null = null,
): Category => ({
  id,
  kind: 'expense',
  parentId,
  name,
  icon: 'other',
  tint: 0,
  budget,
  order: 0,
});
const categories = [
  category('food', 'Food', 6_000_00),
  category('tea', 'Tea', null, 'food'),
  category('fuel', 'Fuel', 3_000_00),
  category('rent', 'Rent', 10_000_00),
  category('fun', 'Fun', 5_000_00),
  category('misc', 'Misc', null),
];
let n = 0;
const spend = (categoryId: string, amount: number, date = '2026-10-05'): Transaction => ({
  id: `t${(n += 1)}`,
  kind: 'expense',
  date,
  amount,
  accountId: 'bank',
  toAccountId: null,
  fee: 0,
  categoryId,
  note: '',
  createdAt: n,
});
const transactions = [
  spend('food', 5_000_00),
  spend('tea', 2_200_00), // subcategory counts toward Food: 7,200 of 6,000
  spend('fuel', 2_500_00), // 83%
  spend('fun', 2_000_00), // 40% by the 10th
  spend('fun', 4_500_00, '2026-09-20'), // the rest of September cost 4,500: about 6,500
  spend('rent', 1_000_00),
  spend('misc', 9_000_00), // no budget: never an alert
  spend('food', 50_000_00, '2026-09-10'), // last month does not count
];

describe('budget alerts', () => {
  it('flags over, nearly used and on-course budgets, most urgent first', () => {
    const alerts = budgetAlerts(categories, transactions, '2026-10-10');
    expect(alerts.map((alert) => [alert.category.name, alert.level])).toEqual([
      ['Food', 'over'],
      ['Fuel', 'near'],
      ['Fun', 'pace'],
    ]);
    expect(alerts[2].projected).toBe(6_500_00);
  });

  it('waits a week before calling the pace', () => {
    const early = budgetAlerts(categories, [spend('fun', 2_000_00, '2026-10-02')], '2026-10-03');
    expect(early).toEqual([]);
  });

  it('words the alerts and sums several up for the Overview', () => {
    const alerts = budgetAlerts(categories, transactions, '2026-10-10');
    expect(alertText(alerts[0])).toBe('Food is ₹1,200 over its ₹6,000 budget');
    expect(alertText(alerts[1])).toBe('Fuel has used 83% of its ₹3,000 budget');
    expect(alertText(alerts[2])).toBe('Fun is on course for about ₹6,500 against a ₹5,000 budget');
    const exact = budgetAlerts(categories, [spend('rent', 10_000_00)], '2026-10-10');
    expect(exact.map((alert) => alert.level)).toEqual(['near']);
    expect(alertText(exact[0])).toBe('Rent has used all of its ₹10,000 budget');
    expect(budgetInsight(alerts)).toMatchObject({
      id: 'budget',
      tone: 'warn',
      title: '3 budgets need a look: 1 over, 2 close to the limit',
      detail: 'Food, Fuel, Fun.',
    });
    expect(budgetInsight([alerts[0]])?.title).toBe('Food is ₹1,200 over its ₹6,000 budget');
    expect(budgetInsight([])).toBeNull();
  });
});
