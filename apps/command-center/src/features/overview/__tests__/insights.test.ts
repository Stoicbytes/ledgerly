import {
  accountBalances,
  type Account,
  type Category,
  type Transaction,
} from '@/lib/domain/expenses';
import { cardDue, overviewInsights, type InsightInput } from '../insights';

const account = (id: string, group: Account['group'], openingBalance = 0): Account => ({
  id,
  name: id,
  group,
  openingBalance,
  order: 0,
});
const categories: Category[] = [
  {
    id: 'food',
    kind: 'expense',
    parentId: null,
    name: 'Food',
    icon: '',
    tint: 0,
    budget: null,
    order: 0,
  },
  {
    id: 'pay',
    kind: 'income',
    parentId: null,
    name: 'Salary',
    icon: '',
    tint: 0,
    budget: null,
    order: 0,
  },
];
let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${(n += 1)}`,
  kind: 'expense',
  date: '2026-10-05',
  amount: 100_00,
  accountId: 'bank',
  toAccountId: null,
  fee: 0,
  categoryId: 'food',
  note: '',
  createdAt: n,
  ...over,
});

const accounts = [account('bank', 'bank', 2_00_000_00), account('card', 'card')];
const transactions = [
  tx({ kind: 'income', amount: 1_00_000_00, categoryId: 'pay', date: '2026-10-01' }),
  tx({ amount: 30_000_00, date: '2026-10-03', note: 'Groceries and dinner' }),
  tx({ amount: 12_000_00, accountId: 'card', date: '2026-10-04' }),
  // the same days of September: much less spent
  tx({ amount: 8_000_00, date: '2026-09-03' }),
  tx({ amount: 10_000_00, date: '2026-08-10' }),
  tx({ amount: 12_000_00, date: '2026-07-10' }),
];
const input = (over: Partial<InsightInput> = {}): InsightInput => ({
  today: '2026-10-15',
  transactions,
  categories,
  accounts,
  balances: accountBalances(accounts, transactions),
  rules: [],
  payslips: [],
  ...over,
});

describe('overview insights', () => {
  it('counts what credit cards are owed', () => {
    expect(cardDue(accounts, accountBalances(accounts, transactions))).toBe(12_000_00);
  });

  it('puts warnings first: card dues, faster spending and a category that grew', () => {
    const list = overviewInsights(input(), 10);
    const ids = list.map((item) => item.id);
    expect(ids.slice(0, 3)).toEqual(expect.arrayContaining(['cards', 'pace', 'category']));
    expect(list.find((item) => item.id === 'cards')?.title).toMatch(/₹12,000 due on credit cards/);
    expect(list.find((item) => item.id === 'pace')?.title).toMatch(/higher than last month/);
    expect(list.find((item) => item.id === 'category')?.title).toMatch(/^Food is up/);
  });

  it('reports the savings rate, the month-end course, cash cover and the largest expense', () => {
    const list = overviewInsights(input(), 10);
    const by = (id: string) => list.find((item) => item.id === id);
    // 1,00,000 in, 42,000 out: 58 % kept
    expect(by('savings-rate')).toMatchObject({
      tone: 'good',
      title: "You kept 58% of this month's income",
    });
    expect(by('projection')?.title).toMatch(/On course to spend about/);
    expect(by('runway')?.title).toMatch(/Your cash covers \d+\.\d months of spending/);
    expect(by('largest')?.detail).toMatch(/Groceries and dinner/);
  });

  it('keeps to the limit and says nothing without entries', () => {
    expect(overviewInsights(input(), 3)).toHaveLength(3);
    expect(overviewInsights(input({ transactions: [], balances: new Map() }))).toEqual([]);
  });
});
