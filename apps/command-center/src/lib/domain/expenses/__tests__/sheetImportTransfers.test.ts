import { planSheetImport, readExpenseSheet, SKIP_REASONS, type Account } from '..';

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

describe('transfers and balance corrections', () => {
  let n = 0;
  const newId = () => `x${(n += 1)}`;
  const bank: Account = {
    id: 'bank',
    name: 'Bank Accounts',
    group: 'bank',
    openingBalance: 0,
    order: 0,
  };
  const sheet2 = [
    HEADER,
    // Out from the bank to Cash, and the same transfer seen from Cash: one transfer
    row({ 0: 46240.4, 2: 'Cash', 3: '', 4: 'ATM', 6: 'Transfer-Out', 7: '', 8: 2000 }),
    row({
      0: 46240.4,
      1: 'Cash',
      2: 'Bank Accounts',
      3: '',
      4: 'ATM',
      6: 'Transfer-In',
      7: '',
      8: 2000,
    }),
    // A transfer only seen from the receiving side
    row({
      0: 46241.5,
      1: 'Wallet',
      2: 'Bank Accounts',
      3: '',
      4: '',
      6: 'Transfer-In',
      7: '',
      8: 500,
    }),
    // Corrections: a new card account, and the existing bank (left out)
    row({ 1: 'Tata nue', 2: 'Modified Bal.', 3: '', 6: 'Income Balance', 8: 52498 }),
    row({ 1: 'Tata nue', 2: 'Modified Bal.', 3: '', 6: 'Expense Balance', 8: 498 }),
    row({ 2: 'Modified Bal.', 3: '', 6: 'Income Balance', 8: 100 }),
  ];

  it('imports each transfer once, from and to the right accounts', () => {
    const plan = planSheetImport(
      readExpenseSheet(sheet2),
      { accounts: [bank], categories: [], transactions: [] },
      newId,
    );
    const byName = new Map(plan.accounts.map((account) => [account.id, account.name]));
    const name = (id: string | null) => (id === 'bank' ? 'Bank Accounts' : byName.get(id ?? ''));
    expect(
      plan.transactions.map((t) => [
        t.kind,
        name(t.accountId),
        name(t.toAccountId),
        t.amount,
        t.categoryId,
      ]),
    ).toEqual([
      ['transfer', 'Bank Accounts', 'Cash', 2_000_00, null],
      ['transfer', 'Bank Accounts', 'Wallet', 500_00, null],
    ]);
    expect(plan).toMatchObject({ transfers: 2, expense: 0, income: 0 });
  });

  it("sets new accounts' opening balances from corrections, never existing ones", () => {
    const plan = planSheetImport(
      readExpenseSheet(sheet2),
      { accounts: [bank], categories: [], transactions: [] },
      newId,
    );
    expect(plan.corrections).toEqual([{ account: 'Tata nue', amount: 52_000_00 }]);
    expect(plan.accounts.find((account) => account.name === 'Tata nue')?.openingBalance).toBe(
      52_000_00,
    );
    expect(plan.skipped).toEqual([{ line: 7, reason: SKIP_REASONS.balance }]);
  });

  it('adds nothing when the same file is imported again', () => {
    const empty = { accounts: [bank], categories: [], transactions: [] };
    const first = planSheetImport(readExpenseSheet(sheet2), empty, newId);
    const again = planSheetImport(
      readExpenseSheet(sheet2),
      { accounts: [bank, ...first.accounts], categories: [], transactions: first.transactions },
      newId,
    );
    expect(again).toMatchObject({ transactions: [], accounts: [], corrections: [], duplicates: 2 });
  });
});
