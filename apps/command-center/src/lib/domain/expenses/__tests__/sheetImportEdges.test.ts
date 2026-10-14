import {
  withoutImported,
  type Account,
  type Category,
  type RecurringEntry,
  type Transaction,
} from '..';
import {
  MAX_IMPORT_ENTRIES,
  cleanName,
  planSheetImport,
  readAmount,
  readExpenseSheet,
  SKIP_REASONS,
} from '../sheetImports';
import { dayFirst, readWhen } from '../sheetDates';

const HEADER = [
  'Period',
  'Accounts',
  'Category',
  'Subcategory',
  'Note',
  'Amount',
  'Income/Expense',
];
const row = (period: string | number, amount: string | number = 100, account = 'Bank') => [
  period,
  account,
  'Food',
  'Tea',
  'Tea',
  amount,
  'Exp.',
];
let n = 0;
const newId = () => `id${(n += 1)}`;
const empty = {
  accounts: [] as Account[],
  categories: [] as Category[],
  transactions: [] as Transaction[],
};

describe('dates in exports', () => {
  it('reads day-first and month-first files, two-digit years and the time of day', () => {
    expect(dayFirst(['14/08/2026', '01/02/2026'])).toBe(true);
    expect(dayFirst(['8/14/2026 7:05 PM', '1/2/2026'])).toBe(false);
    expect(dayFirst(['01/02/2026'])).toBe(true);
    expect(readWhen('01/02/2026', true)?.date).toBe('2026-02-01');
    expect(readWhen('01/02/2026', false)?.date).toBe('2026-01-02');
    const evening = readWhen('8/14/26 7:05 PM', false);
    expect(evening?.date).toBe('2026-08-14');
    expect(new Date(evening!.at).toISOString()).toBe('2026-08-14T19:05:00.000Z');
    expect(readWhen('2026-08-14T10:49:30')?.at).toBe(Date.UTC(2026, 7, 14, 10, 49, 30));
    expect(readWhen('12 AM 2026-01-01')).toBeNull();
  });

  it('refuses impossible dates and dates the database would refuse', () => {
    expect(readWhen('31/02/2026')).toBeNull();
    expect(readWhen('2150-01-01')).toBeNull();
    expect(readWhen(80000)).toBeNull(); // year 2119
    expect(readWhen(0)).toBeNull();
    expect(readWhen(46248.999)?.date).toBe('2026-08-14');
  });

  it('skips a whole file of unreadable dates row by row, not silently', () => {
    const read = readExpenseSheet([HEADER, row('someday'), row('14/08/2026')]);
    expect(read.rows).toHaveLength(1);
    expect(read.skipped).toEqual([{ line: 2, reason: SKIP_REASONS.date }]);
  });
});

describe('amounts in exports', () => {
  it('reads currency signs, separators and words; refuses negatives and text', () => {
    expect(readAmount('₹1,234.50')).toBe(1_234_50);
    expect(readAmount('1,234.50 INR')).toBe(1_234_50);
    expect(readAmount(0.29)).toBe(29);
    expect(readAmount('abc')).toBeNaN();
    const read = readExpenseSheet([HEADER, row('2026-08-14', '-50'), row('2026-08-14', '')]);
    expect(read.rows).toEqual([]);
    expect(read.skipped.map((item) => item.reason)).toEqual([
      SKIP_REASONS.amount,
      SKIP_REASONS.amount,
    ]);
  });
});

describe('names the database would refuse', () => {
  it('cuts account names to 60 and category names to 40 characters', () => {
    expect(cleanName('  a   b  ', 60)).toBe('a b');
    expect(cleanName('அ'.repeat(50), 40)).toBe('அ'.repeat(40));
    const long = 'A very long bank account name that goes on and on beyond sixty characters';
    const sheet = [
      HEADER,
      [...row('2026-08-14', 10, long).slice(0, 2), 'C'.repeat(45), '', '', 10, 'Exp.'],
    ];
    const plan = planSheetImport(readExpenseSheet(sheet), empty, newId);
    expect(Array.from(plan.accounts[0].name).length).toBeLessThanOrEqual(60);
    expect(plan.categories[0].name).toBe('C'.repeat(40));
    // importing again matches the shortened names instead of creating them twice
    const again = planSheetImport(
      readExpenseSheet(sheet),
      { accounts: plan.accounts, categories: plan.categories, transactions: [] },
      newId,
    );
    expect(again.accounts).toEqual([]);
    expect(again.categories).toEqual([]);
  });
});

describe('large files', () => {
  it('imports at most one batch, oldest first, and the rest on the next import', () => {
    const rows = Array.from({ length: MAX_IMPORT_ENTRIES + 5 }, (_, i) => row(40000 + i));
    const read = readExpenseSheet([HEADER, ...rows]);
    const first = planSheetImport(read, empty, newId);
    expect(first.transactions).toHaveLength(MAX_IMPORT_ENTRIES);
    expect(first.remaining).toBe(5);
    expect(first.range?.start).toBe('2009-07-06');
    const second = planSheetImport(
      read,
      { accounts: first.accounts, categories: first.categories, transactions: first.transactions },
      newId,
    );
    expect(second).toMatchObject({ remaining: 0, duplicates: MAX_IMPORT_ENTRIES });
    expect(second.transactions).toHaveLength(5);
  });
});

describe('undoing an import', () => {
  const sheet = [HEADER, row('2026-08-14'), row('2026-08-15')];
  const plan = planSheetImport(readExpenseSheet(sheet), empty, newId);
  const own: Transaction = { ...plan.transactions[0], id: 'mine', note: 'added later' };
  const ledger = {
    accounts: plan.accounts,
    categories: plan.categories,
    transactions: [...plan.transactions, own],
    people: [],
  };

  it('removes the imported entries and keeps what was added afterwards', () => {
    const after = withoutImported(ledger, plan, []);
    expect(after.transactions.map((item) => item.id)).toEqual(['mine']);
    // "mine" still uses the imported account and Tea (under Food), so they stay
    expect(after.accounts).toHaveLength(1);
    expect(after.categories.map((item) => item.name).sort()).toEqual(['Food', 'Tea']);
  });

  it('removes created accounts and categories nothing else uses', () => {
    const after = withoutImported({ ...ledger, transactions: plan.transactions }, plan, []);
    expect(after).toMatchObject({ transactions: [], accounts: [], categories: [] });
  });

  it('keeps an account a recurring entry uses, and drops repayment links to removed entries', () => {
    const rule = {
      accountId: plan.accounts[0].id,
      toAccountId: null,
      categoryId: null,
    } as RecurringEntry;
    const repayment: Transaction = {
      ...plan.transactions[0],
      id: 'repaid',
      kind: 'income',
      categoryId: null,
      settles: [plan.transactions[0].id, 'other'],
    };
    const after = withoutImported(
      { ...ledger, transactions: [...plan.transactions, repayment] },
      plan,
      [rule],
    );
    expect(after.accounts).toHaveLength(1);
    expect(after.transactions).toEqual([{ ...repayment, settles: ['other'] }]);
  });
});

describe('emoji in names', () => {
  const sheet = [
    HEADER,
    ['2026-08-14', 'Bank', '🙂', '', 'Treat', 50, 'Exp.'],
    ['2026-08-14', 'Bank', 'Food 🍔', 'Tea ☕️', 'Tea ☕', 10, 'Exp.'],
    ['2026-08-14', 'Bank', 'Food', '👍🏽', 'Snack', 20, 'Exp.'],
    ['2026-08-14', '💳', 'Food', '', '', 30, 'Exp.'],
  ];

  it('leaves emoji out of names and imports emoji-only categories as uncategorised', () => {
    expect(cleanName(' 🍔  Food 👨‍👩‍👧 ', 40)).toBe('Food');
    const plan = planSheetImport(readExpenseSheet(sheet), empty, newId);
    expect(plan.transactions).toHaveLength(4);
    expect(plan.categories.map((item) => item.name)).toEqual(['Food', 'Tea']);
    const by = (amount: number) => plan.transactions.find((item) => item.amount === amount)!;
    expect(by(50_00).categoryId).toBeNull();
    // an emoji-only subcategory files the entry under its parent
    expect(by(20_00).categoryId).toBe(plan.categories[0].id);
    expect(plan.accounts.map((item) => item.name)).toEqual(['Bank', 'Imported']);
    // notes keep their emoji
    expect(by(10_00).note).toBe('Tea ☕');
  });

  it('matches your categories that carry emoji', () => {
    const food: Category = {
      id: 'food',
      kind: 'expense',
      parentId: null,
      name: '🍔 Food',
      icon: 'food',
      tint: 0,
      budget: null,
      order: 0,
    };
    const plan = planSheetImport(readExpenseSheet(sheet), { ...empty, categories: [food] }, newId);
    expect(plan.categories.map((item) => item.name)).toEqual(['Tea']);
    expect(plan.categories[0].parentId).toBe('food');
  });
});
