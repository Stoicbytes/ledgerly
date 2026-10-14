import { budgetAlerts, projectMonthEnd, type Category, type Transaction } from '..';

let n = 0;
const spend = (date: string, amount: number, categoryId = 'home'): Transaction => ({
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
const category = (id: string, budget: number | null): Category => ({
  id,
  kind: 'expense',
  parentId: null,
  name: id === 'home' ? 'Home' : 'Food',
  icon: 'other',
  tint: 0,
  budget,
  order: 0,
});
// Each of the last three months: ₹20,000 rent on the 1st and ₹300 a day of food
const month = (m: string, days: number) => [
  spend(`${m}-01`, 20_000_00),
  ...Array.from({ length: days }, (_, i) =>
    spend(`${m}-${String(i + 1).padStart(2, '0')}`, 300_00, 'food'),
  ),
];
const history = [...month('2026-07', 31), ...month('2026-08', 31), ...month('2026-09', 30)];
const october = [...month('2026-10', 7)];

describe('month-end projection', () => {
  it('adds what you usually spend in the rest of a month, not this month’s daily rate', () => {
    const result = projectMonthEnd([...history, ...october], '2026-10-07');
    // Spent: 20,000 + 7 × 300 = 22,100. The rest of the month (8th–31st) usually costs
    // 24 × 300 = 7,200 (median of Jul, Aug, Sep; Sep has only 23 days left: 6,900).
    expect(result).toEqual({ spent: 22_100_00, rest: 7_200_00, projected: 29_300_00 });
    // The old daily-rate projection said 22,100 / 7 × 31 = 97,871
  });

  it('has nothing to project from without earlier months', () => {
    expect(projectMonthEnd(october, '2026-10-07')).toBeNull();
  });

  it('does not call the pace of a budget on one big early cost', () => {
    const categories = [category('home', 30_000_00), category('food', 10_000_00)];
    const alerts = budgetAlerts(categories, [...history, ...october], '2026-10-07');
    expect(alerts).toEqual([]);
    // Food at 1,000 a day for a week runs ahead of its usual pace
    const heavy = [
      ...history,
      ...Array.from({ length: 7 }, (_, i) => spend(`2026-10-0${i + 1}`, 1_000_00, 'food')),
    ];
    const [alert] = budgetAlerts(categories, heavy, '2026-10-07');
    expect(alert).toMatchObject({ level: 'pace', projected: 7_000_00 + 7_200_00 });
  });
});
