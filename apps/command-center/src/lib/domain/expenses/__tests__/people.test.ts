import { categoryBreakdown } from '../breakdowns';
import { monthBounds } from '../dates';
import { accountBalance } from '../balances';
import {
  equalShares,
  inferSplitMode,
  isRepayment,
  ownShare,
  personBalances,
  personInUse,
  splitsError,
} from '../people';
import { periodTotals } from '../periods';
import type { Category, Person, Transaction } from '../types';

const base: Transaction = {
  id: '',
  kind: 'expense',
  date: '2026-10-01',
  amount: 0,
  accountId: 'cash',
  toAccountId: null,
  fee: 0,
  categoryId: 'food',
  note: '',
  createdAt: 0,
};
const people: Person[] = [
  { id: 'ravi', name: 'Ravi', order: 0 },
  { id: 'priya', name: 'Priya', order: 1 },
];
const categories: Category[] = [
  {
    id: 'food',
    kind: 'expense',
    parentId: null,
    name: 'Food',
    icon: 'food',
    tint: 0,
    budget: null,
    order: 0,
  },
];
// Dinner ₹1,500: Ravi and Priya owe ₹500 each, you keep ₹500.
const dinner: Transaction = {
  ...base,
  id: 'dinner',
  amount: 150_000,
  splits: [
    { personId: 'ravi', amount: 50_000 },
    { personId: 'priya', amount: 50_000 },
  ],
};
const movie: Transaction = {
  ...base,
  id: 'movie',
  date: '2026-10-05',
  amount: 60_000,
  splits: [{ personId: 'ravi', amount: 30_000 }],
};
const raviPays: Transaction = {
  ...base,
  id: 'pay',
  kind: 'income',
  date: '2026-10-06',
  amount: 60_000,
  accountId: 'bank',
  categoryId: null,
  personId: 'ravi',
};
const ledger = [dinner, movie, raviPays];

describe('splits', () => {
  it('counts only your share in totals and Stats, and repayments not at all', () => {
    expect(ownShare(dinner)).toBe(50_000);
    expect(ownShare(raviPays)).toBe(0);
    expect(isRepayment(raviPays)).toBe(true);
    expect(periodTotals(ledger, monthBounds('2026-10'))).toEqual({
      income: 0,
      expense: 80_000,
      net: -80_000,
    });
    const slices = categoryBreakdown(ledger, categories, 'expense', monthBounds('2026-10'));
    expect(slices.map((slice) => [slice.id, slice.amount])).toEqual([['food', 80_000]]);
    expect(categoryBreakdown(ledger, categories, 'income', monthBounds('2026-10'))).toEqual([]);
  });

  it('still takes the full amount from the paying account and adds repayments', () => {
    const cash = { id: 'cash', name: 'Cash', group: 'cash' as const, openingBalance: 0, order: 0 };
    const bank = { id: 'bank', name: 'Bank', group: 'bank' as const, openingBalance: 0, order: 1 };
    expect(accountBalance(cash, ledger)).toBe(-210_000);
    expect(accountBalance(bank, ledger)).toBe(60_000);
  });

  it('settles the oldest shares first and tracks what is still owed', () => {
    const [ravi, priya] = personBalances(people, ledger);
    expect(ravi).toMatchObject({ lent: 80_000, repaid: 60_000, outstanding: 20_000 });
    // Newest first for display: the movie share is half paid, the dinner share fully.
    expect(ravi.splits.map((split) => [split.transaction.id, split.paid, split.remaining])).toEqual(
      [
        ['movie', 10_000, 20_000],
        ['dinner', 50_000, 0],
      ],
    );
    expect(priya).toMatchObject({ lent: 50_000, repaid: 0, outstanding: 50_000 });
  });

  it('settles the chosen expense first when a payment names it', () => {
    // Ravi pays exactly his movie share; the older dinner share stays open.
    const forMovie: Transaction = {
      ...raviPays,
      id: 'movie-pay',
      amount: 30_000,
      settles: ['movie'],
    };
    const [ravi] = personBalances(people, [dinner, movie, forMovie]);
    expect(ravi.splits.map((split) => [split.transaction.id, split.paid, split.remaining])).toEqual(
      [
        ['movie', 30_000, 0],
        ['dinner', 0, 50_000],
      ],
    );
    // Paying more than the named share spills over to the oldest open share.
    const extra: Transaction = { ...forMovie, amount: 40_000 };
    const [again] = personBalances(people, [dinner, movie, extra]);
    expect(again.splits.map((split) => split.paid)).toEqual([30_000, 10_000]);
    expect(again.outstanding).toBe(40_000);
  });

  it('splits equally: odd paise stay with you, or spread so the others pay it all', () => {
    expect(equalShares(100_000, 2, true)).toEqual([33_333, 33_333]);
    expect(equalShares(100_000, 2, false)).toEqual([50_000, 50_000]);
    expect(equalShares(100, 3, false)).toEqual([34, 33, 33]);
    expect(equalShares(100_000, 0, true)).toEqual([]);
  });

  it('recognises the split mode of a saved expense', () => {
    expect(inferSplitMode(150_000, [50_000, 50_000])).toBe('equal');
    expect(inferSplitMode(100, [34, 33, 33])).toBe('others');
    expect(inferSplitMode(150_000, [70_000, 20_000])).toBe('custom');
    expect(inferSplitMode(150_000, [])).toBe('equal');
  });

  it('rejects shares that are empty, repeated or larger than the expense', () => {
    expect(splitsError(1_000, [{ personId: 'ravi', amount: 0 }])).toMatch(/amount for each/);
    expect(
      splitsError(1_000, [
        { personId: 'ravi', amount: 100 },
        { personId: 'ravi', amount: 100 },
      ]),
    ).toMatch(/once/);
    expect(splitsError(1_000, [{ personId: 'ravi', amount: 1_001 }])).toMatch(/more than/);
    expect(splitsError(1_000, [{ personId: 'ravi', amount: 1_000 }])).toBeNull();
  });

  it('knows when a person still has shares or repayments', () => {
    expect(personInUse('ravi', ledger)).toBe(true);
    expect(personInUse('someone', ledger)).toBe(false);
  });
});
