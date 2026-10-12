import type { Account, Category, Transaction } from '../types';

/**
 * Small hand-checked ledger (paise). Expected values in the tests are worked
 * out by hand from these rows, not by calling the code under test.
 */
export const accounts: Account[] = [
  { id: 'bank', name: 'Bank', group: 'bank', openingBalance: 5_000_000, order: 0 },
  { id: 'card', name: 'Card', group: 'card', openingBalance: -200_000, order: 1 },
  { id: 'cash', name: 'Cash', group: 'cash', openingBalance: 100_000, order: 2 },
];

export const categories: Category[] = [
  {
    id: 'food',
    kind: 'expense',
    parentId: null,
    name: 'Food',
    icon: 'food',
    tint: 3,
    budget: 500_000,
    order: 0,
  },
  {
    id: 'tea',
    kind: 'expense',
    parentId: 'food',
    name: 'Tea',
    icon: 'food',
    tint: 3,
    budget: null,
    order: 0,
  },
  {
    id: 'rent',
    kind: 'expense',
    parentId: null,
    name: 'Rent',
    icon: 'home',
    tint: 2,
    budget: 1_000_000,
    order: 1,
  },
  {
    id: 'gift',
    kind: 'expense',
    parentId: null,
    name: 'Gift',
    icon: 'gift',
    tint: 5,
    budget: null,
    order: 2,
  },
  {
    id: 'salary',
    kind: 'income',
    parentId: null,
    name: 'Salary',
    icon: 'salary',
    tint: 0,
    budget: null,
    order: 0,
  },
];

const base = { toAccountId: null, fee: 0, note: '' };

export const transactions: Transaction[] = [
  {
    ...base,
    id: 't1',
    kind: 'income',
    date: '2026-10-01',
    amount: 8_000_000,
    accountId: 'bank',
    categoryId: 'salary',
    createdAt: 1,
  },
  {
    ...base,
    id: 't2',
    kind: 'expense',
    date: '2026-10-02',
    amount: 1_000_000,
    accountId: 'bank',
    categoryId: 'rent',
    createdAt: 2,
  },
  {
    ...base,
    id: 't3',
    kind: 'expense',
    date: '2026-10-03',
    amount: 5_000,
    accountId: 'card',
    categoryId: 'tea',
    note: 'Tea',
    createdAt: 3,
  },
  {
    ...base,
    id: 't4',
    kind: 'expense',
    date: '2026-10-03',
    amount: 30_000,
    accountId: 'cash',
    categoryId: 'food',
    note: 'Lunch',
    createdAt: 4,
  },
  {
    ...base,
    id: 't5',
    kind: 'transfer',
    date: '2026-10-10',
    amount: 200_000,
    accountId: 'bank',
    toAccountId: 'card',
    fee: 1_000,
    categoryId: null,
    createdAt: 5,
  },
  {
    ...base,
    id: 't6',
    kind: 'expense',
    date: '2026-09-28',
    amount: 4_000,
    accountId: 'card',
    categoryId: 'tea',
    note: 'tea',
    createdAt: 0,
  },
  {
    ...base,
    id: 't7',
    kind: 'expense',
    date: '2026-10-05',
    amount: 10_000,
    accountId: 'bank',
    categoryId: null,
    createdAt: 6,
  },
];

export const october = { start: '2026-10-01', end: '2026-10-31' };
