import {
  accountBalances,
  type Account,
  type Category,
  type Transaction,
} from '@/lib/domain/expenses';
import { pay, pf, slip } from '@/lib/domain/insights/__fixtures__/salary';
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

  it('compares the savings rate with the six months before', () => {
    const history = [
      ...transactions,
      tx({ kind: 'income', amount: 50_000_00, categoryId: 'pay', date: '2026-09-01' }),
    ];
    // Sep: 50,000 in, 8,000 out (84%); Aug and Jul have no income and do not count
    const rate = overviewInsights(input({ transactions: history }), 10).find(
      (item) => item.id === 'savings-rate',
    );
    expect(rate?.detail).toBe(
      '₹1,00,000 in, ₹42,000 out so far; 84% on average over the last 6 months.',
    );
  });

  it('adds salary and PF lines: a missing payslip first, then the raise, TDS and PF', () => {
    const payslips = [
      slip('2026-04', pay(60_000_00)),
      slip('2026-05', { ...pay(67_200_00), employerEpf: 0, employerEps: 0 }),
    ];
    const pfEntries = [
      pf('2024-04-01', { kind: 'opening', employee: 1_00_000_00 }),
      pf('2026-05-01', { employee: 6_000_00, employer: 4_000_00 }),
    ];
    const list = overviewInsights(
      input({ payslips, pfEntries, employers: [], transactions: [], balances: new Map() }),
      10,
    );
    expect(list.map((item) => item.id)).toEqual([
      'payslip-missing',
      'salary-change',
      'pf-growth',
      'tds',
      'pf-interest',
      'pf-employer',
    ]);
    expect(list[0].title).toBe('No payslip for June yet');
    expect(list[1].title).toBe('Gross pay up 12% from April');
    expect(list.find((item) => item.id === 'pf-interest')?.title).toBe(
      'Add PF interest for 2 years from your passbook',
    );
    // Six at most, warnings first
    expect(overviewInsights(input({ payslips, pfEntries }))).toHaveLength(6);
    expect(overviewInsights(input({ payslips, pfEntries }))[0].tone).toBe('warn');
  });

  it('keeps to the limit and says nothing without entries', () => {
    expect(overviewInsights(input(), 3)).toHaveLength(3);
    expect(overviewInsights(input({ transactions: [], balances: new Map() }))).toEqual([]);
  });
});
