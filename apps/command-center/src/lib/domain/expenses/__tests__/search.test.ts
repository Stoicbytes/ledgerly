import { accounts, categories, transactions } from '../__fixtures__/ledger';
import { EMPTY_SEARCH, isSearching, searchTotals, searchTransactions } from '../search';

const context = { accounts, categories, people: [{ id: 'ravi', name: 'Ravi', order: 0 }] };
const ids = (patch: Partial<typeof EMPTY_SEARCH>) =>
  searchTransactions(transactions, { ...EMPTY_SEARCH, ...patch }, context).map((t) => t.id);

describe('searchTransactions', () => {
  it('finds words in the note, category and account, newest first, across months', () => {
    expect(ids({ text: 'tea' })).toEqual(['t3', 't6']);
    expect(ids({ text: 'TEA card' })).toEqual(['t3', 't6']);
    expect(ids({ text: 'lunch cash' })).toEqual(['t4']);
    expect(ids({ text: 'rent' })).toEqual(['t2']);
  });

  it('treats a number as an amount, not as part of other numbers', () => {
    expect(ids({ text: '50' })).toEqual(['t3']);
    expect(ids({ text: '300.00' })).toEqual(['t4']);
    expect(ids({ text: '5' })).toEqual([]);
  });

  it('filters by type, category with its subcategories, account and dates', () => {
    expect(ids({ kind: 'transfer' })).toEqual(['t5']);
    expect(ids({ kind: 'expense', categoryId: 'food' })).toEqual(
      expect.arrayContaining(['t3', 't4', 't6']),
    );
    expect(ids({ kind: 'expense', categoryId: 'food' })).not.toContain('t2');
    expect(ids({ accountId: 'card' })).toEqual(expect.arrayContaining(['t3', 't5', 't6']));
    expect(ids({ from: '2026-10-01', to: '2026-10-03', kind: 'expense' })).toEqual([
      't4',
      't3',
      't2',
    ]);
  });

  it('knows when nothing is being searched, and adds up the results', () => {
    expect(isSearching(EMPTY_SEARCH)).toBe(false);
    expect(isSearching({ ...EMPTY_SEARCH, text: '  ' })).toBe(false);
    const found = searchTransactions(
      transactions,
      { ...EMPTY_SEARCH, from: '2026-10-01', to: '2026-10-03' },
      context,
    );
    expect(searchTotals(found)).toEqual({ count: 4, income: 8_000_000, expense: 1_035_000 });
  });
});
