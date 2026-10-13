import {
  joinNote,
  planSheetImport,
  readExpenseSheet,
  SKIP_REASONS,
  type Account,
  type Category,
  type Transaction,
} from '..';

const HEADER = [
  'Period',
  'Accounts',
  'Category',
  'Subcategory',
  'Note',
  'INR',
  'Income/Expense',
  'Description',
  'Amount',
  'Currency',
  'Accounts',
];
// 46248.45 is 14 Aug 2026 10:49; 46248.83 is the same day at 19:55 (not the next day).
const row = (over: Record<number, string | number | null>) => {
  const base: (string | number | null)[] = [
    46248.45,
    'Bank Accounts',
    'Food',
    'Tea',
    'Canteen',
    15,
    'Exp.',
    'Canteen',
    15,
    'INR',
    15,
  ];
  for (const [index, value] of Object.entries(over)) base[Number(index)] = value;
  return base;
};

const sheet = [
  ['Some title row'],
  HEADER,
  row({}),
  row({ 0: 46248.83, 3: 'Lunch', 4: 'Meals', 7: 'Meals with team', 8: 120.5 }),
  row({ 2: 'Salary', 3: null, 4: '', 6: 'Income', 7: '', 8: 50000 }),
  row({ 1: 'Wallet', 2: 'Modified Bal.', 6: 'Income Balance', 8: 52498 }),
  row({ 6: 'Transfer-Out' }),
  row({ 8: 0 }),
  row({ 0: 'not a date' }),
  [null, null, ''],
  row({ 1: 'Cash ', 2: 'Sports ', 3: 'Turf', 8: 291 }),
];

describe('reading an expense export', () => {
  const read = readExpenseSheet(sheet);

  it('finds the header and reads expenses and income, keeping the day of late entries', () => {
    expect(read.problems).toEqual([]);
    expect(read.rows).toHaveLength(4);
    expect(read.rows[0]).toMatchObject({
      line: 3,
      date: '2026-08-14',
      kind: 'expense',
      account: 'Bank Accounts',
      category: 'Food',
      subcategory: 'Tea',
      note: 'Canteen',
      amount: 15_00,
    });
    expect(read.rows[1]).toMatchObject({ date: '2026-08-14', amount: 120_50 });
    expect(read.rows[1].note).toBe('Meals with team');
    expect(read.rows[2]).toMatchObject({ kind: 'income', category: 'Salary', subcategory: '' });
    expect(read.rows[1].at).toBeGreaterThan(read.rows[0].at);
  });

  it('says why rows are left out', () => {
    expect(read.skipped.map((item) => item.reason)).toEqual([
      SKIP_REASONS.balance,
      SKIP_REASONS.transfer,
      SKIP_REASONS.amount,
      SKIP_REASONS.date,
    ]);
  });

  it('refuses a file without the columns', () => {
    expect(readExpenseSheet([['Date', 'Amount']]).problems[0]).toMatch(/does not look like/);
  });

  it('joins the note and the description without repeating them', () => {
    expect(joinNote('Tea', 'Tea')).toBe('Tea');
    expect(joinNote('', 'Tea')).toBe('Tea');
    expect(joinNote('Snacks', 'Snacks with friends')).toBe('Snacks with friends');
    expect(joinNote('Toll', 'Highway shop')).toBe('Toll · Highway shop');
    expect(joinNote('x'.repeat(200), '')).toHaveLength(120);
  });
});

describe('planning the import', () => {
  let n = 0;
  const newId = () => `id${(n += 1)}`;
  const accounts: Account[] = [
    { id: 'cash', name: 'Cash', group: 'cash', openingBalance: 0, order: 0 },
  ];
  const categories: Category[] = [
    {
      id: 'food',
      kind: 'expense',
      parentId: null,
      name: 'food',
      icon: 'food',
      tint: 1,
      budget: null,
      order: 0,
    },
  ];
  const read = readExpenseSheet(sheet);

  it('adds what is missing and reuses accounts and categories by name', () => {
    const plan = planSheetImport(read, { accounts, categories, transactions: [] }, newId);
    expect(plan.transactions).toHaveLength(4);
    expect(plan.accounts.map((item) => [item.name, item.group, item.openingBalance])).toEqual([
      ['Bank Accounts', 'bank', 0],
    ]);
    // Food exists; Tea and Lunch go under it with its look; Salary, Sports and Turf are new
    const names = plan.categories.map((item) => `${item.kind}:${item.name}`);
    expect(names).toEqual([
      'expense:Tea',
      'income:Salary',
      'expense:Sports',
      'expense:Turf',
      'expense:Lunch',
    ]);
    const tea = plan.categories[0];
    expect(tea).toMatchObject({ parentId: 'food', icon: 'food', tint: 1 });
    expect(plan.categories[1].icon).toBe('salary');
    const turf = plan.transactions.find((item) => item.amount === 291_00);
    expect(turf?.accountId).toBe('cash');
    expect(plan).toMatchObject({
      expense: 15_00 + 120_50 + 291_00,
      income: 50_000_00,
      duplicates: 0,
      range: { start: '2026-08-14', end: '2026-08-14' },
    });
    expect(plan.skipped).toHaveLength(4);
  });

  it('skips entries already in the ledger, so importing twice adds nothing', () => {
    const first = planSheetImport(read, { accounts, categories, transactions: [] }, newId);
    const ledger = {
      accounts: [...accounts, ...first.accounts],
      categories: [...categories, ...first.categories],
      transactions: first.transactions as Transaction[],
    };
    const again = planSheetImport(read, ledger, newId);
    expect(again).toMatchObject({ transactions: [], accounts: [], categories: [], duplicates: 4 });
  });

  it('keeps two identical entries on one day as two', () => {
    const twice = readExpenseSheet([HEADER, row({}), row({})]);
    const one = planSheetImport(
      readExpenseSheet([HEADER, row({})]),
      { accounts, categories, transactions: [] },
      newId,
    );
    const plan = planSheetImport(
      twice,
      {
        accounts: [...accounts, ...one.accounts],
        categories: [...categories, ...one.categories],
        transactions: one.transactions,
      },
      newId,
    );
    expect(plan.transactions).toHaveLength(1);
    expect(plan.duplicates).toBe(1);
  });
});
