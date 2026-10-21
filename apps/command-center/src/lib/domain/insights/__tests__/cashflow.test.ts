import {
  averageSavingsRate,
  monthTotals,
  netWorthHistory,
  spendingMix,
} from '@/lib/domain/insights';
import {
  monthlySeries,
  type Account,
  type Category,
  type Transaction,
} from '@/lib/domain/expenses';
import { pf } from '../__fixtures__/salary';

let n = 0;
const tx = (date: string, over: Partial<Transaction> = {}): Transaction => ({
  id: `t${(n += 1)}`,
  kind: 'expense',
  date,
  amount: 1_000_00,
  accountId: 'bank',
  toAccountId: null,
  fee: 0,
  categoryId: 'food',
  note: '',
  createdAt: n,
  ...over,
});
const category = (id: string, name: string): Category => ({
  id,
  kind: 'expense',
  parentId: null,
  name,
  icon: '',
  tint: 0,
  budget: null,
  order: 0,
});
const categories = ['food', 'rent', 'fuel', 'fun', 'gifts', 'books', 'pets'].map((id) =>
  category(id, id[0].toUpperCase() + id.slice(1)),
);

const ledger = [
  tx('2026-08-01', { kind: 'income', amount: 1_00_000_00, categoryId: null }),
  tx('2026-08-05', { amount: 40_000_00, categoryId: 'rent' }),
  tx('2026-09-01', { kind: 'income', amount: 1_00_000_00, categoryId: null }),
  tx('2026-09-05', { amount: 70_000_00, categoryId: 'rent' }),
  tx('2026-09-06', { kind: 'transfer', amount: 5_000_00, toAccountId: 'fund', fee: 10_00 }),
  tx('2026-10-01', { kind: 'income', amount: 1_00_000_00, categoryId: null }),
  tx('2026-10-03', { amount: 3_000_00 }),
];

describe('month totals', () => {
  it('matches monthlySeries in one pass, transfer fees included', () => {
    const fast = monthTotals(ledger, '2026-10', 4);
    const slow = monthlySeries('2026-10', 4, ledger);
    expect(fast).toEqual(
      slow.map(({ month, income, expense, net }) => ({ month, income, expense, net })),
    );
    expect(fast[2]).toEqual({
      month: '2026-09',
      income: 1_00_000_00,
      expense: 70_010_00,
      net: 29_990_00,
    });
  });

  it('works out the savings rate over months with income', () => {
    // Aug kept 60,000 and Sep 29,990 of 2,00,000: 44.995%
    expect(averageSavingsRate(monthTotals(ledger, '2026-09', 6))).toBeCloseTo(44.995, 3);
    expect(averageSavingsRate(monthTotals([], '2026-09', 6))).toBeNull();
  });
});

describe('net worth history', () => {
  const accounts: Account[] = [
    { id: 'bank', name: 'Bank', group: 'bank', openingBalance: 10_000_00, order: 0 },
    { id: 'card', name: 'Card', group: 'card', openingBalance: 0, order: 1 },
    { id: 'fund', name: 'Mutual funds', group: 'investment', openingBalance: 0, order: 2 },
  ];
  const months = ['2026-07', '2026-08', '2026-09', '2026-10'];

  it('adds month-end balances, investments and PF, from the first entry on', () => {
    const points = netWorthHistory({
      accounts,
      transactions: [...ledger, tx('2026-08-20', { accountId: 'card', amount: 9_000_00 })],
      tracking: { funds: true, stocks: false },
      pfEntries: [pf('2026-01-01', { kind: 'opening', employee: 50_000_00 })],
      months,
      funds: [0, 0, 5_000_00, 5_500_00],
      stocks: [0, 0, 0, 1_000_00],
    });
    // July has no entries yet: left out. Card and the fund account (valued on Mutual funds)
    // do not count. Bank: 10,000 + 1,00,000 − 40,000 = 70,000 at the end of August.
    expect(points.map((point) => point.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(points[0]).toEqual({
      month: '2026-08',
      accounts: 70_000_00,
      investments: 0,
      pf: 50_000_00,
      total: 1_20_000_00,
    });
    // September: + 1,00,000 − 70,000 − 5,010 = 94,990
    expect(points[1].accounts).toBe(94_990_00);
    expect(points[1].total).toBe(94_990_00 + 5_000_00 + 50_000_00);
    // October: + 1,00,000 − 3,000; funds and shares 6,500
    expect(points[2]).toMatchObject({ accounts: 1_91_990_00, investments: 6_500_00 });
  });

  it('starts at the first month with funds or PF when there are no entries', () => {
    const points = netWorthHistory({
      accounts,
      transactions: [],
      tracking: { funds: false, stocks: false },
      pfEntries: [],
      months,
      funds: [0, 2_000_00, 2_100_00, 2_200_00],
      stocks: [0, 0, 0, 0],
    });
    expect(points.map((point) => point.total)).toEqual([12_000_00, 12_100_00, 12_200_00]);
  });
});

describe('spending mix', () => {
  it('keeps the five largest, folds the rest into Other and compares with last month', () => {
    const october = ['food', 'rent', 'fuel', 'fun', 'gifts', 'books', 'pets'].map((id, index) =>
      tx('2026-10-02', { categoryId: id, amount: (7 - index) * 1_000_00 }),
    );
    const september = [
      tx('2026-09-01', { categoryId: 'food', amount: 2_000_00 }),
      tx('2026-09-02', { categoryId: 'pets', amount: 500_00 }),
      tx('2026-09-25', { categoryId: 'rent', amount: 9_000_00 }), // after the 21st: not compared
    ];
    const mix = spendingMix([...october, ...september], categories, '2026-10-21');
    expect(mix.rows.map((row) => [row.name, row.amount, row.previous])).toEqual([
      ['Food', 7_000_00, 2_000_00],
      ['Rent', 6_000_00, 0],
      ['Fuel', 5_000_00, 0],
      ['Fun', 4_000_00, 0],
      ['Gifts', 3_000_00, 0],
      ['Other (2)', 3_000_00, 500_00],
    ]);
    expect(mix.total).toBe(28_000_00);
    expect(mix.previousTotal).toBe(2_500_00);
  });
});
