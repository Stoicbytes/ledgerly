import {
  accountBalance,
  balanceSummary,
  periodTotals,
  undoCategoryDelete,
} from '@/lib/domain/expenses';
import { accounts, categories, transactions } from '@/lib/domain/expenses/__fixtures__/ledger';
import { getLedger, useExpenseStore } from '../expenseStore';
import { deletePerson, recordRepayment, savePerson } from '../peopleActions';

const store = () => useExpenseStore.getState();

beforeEach(() => {
  store().restoreLedger({ accounts, categories, transactions, people: [] });
});

describe('seed', () => {
  it('models card bills and SIPs as transfers, never as spending categories', () => {
    store().resetPreview();
    const { categories: seeded, transactions: rows, accounts: seededAccounts } = store();
    const names = seeded.map((item) => item.name.toLocaleLowerCase());
    expect(names).not.toContain('savings');
    expect(names).not.toContain('credit card bill');
    expect(rows.some((row) => row.kind === 'transfer' && row.toAccountId === 'acc-card')).toBe(
      true,
    );
    expect(rows.some((row) => row.kind === 'transfer' && row.toAccountId === 'acc-sip')).toBe(true);
    expect(seeded.find((item) => item.name === 'Food')).toBeDefined();
    expect(seeded.filter((item) => item.parentId === 'expense-food')).toHaveLength(15);
    // Every seeded row references real accounts and categories of the right kind.
    for (const row of rows) {
      expect(seededAccounts.some((account) => account.id === row.accountId)).toBe(true);
      if (row.kind !== 'transfer')
        expect(seeded.find((item) => item.id === row.categoryId)?.kind).toBe(row.kind);
    }
    expect(balanceSummary(seededAccounts, rows).total).toBeGreaterThan(0);
  });
});

describe('transactions', () => {
  const value = {
    kind: 'expense' as const,
    date: '2026-10-07',
    amount: 25_000,
    accountId: 'cash',
    toAccountId: null,
    fee: 0,
    categoryId: 'tea',
    note: 'Tea',
  };

  it('creates, edits and deletes with undo', () => {
    const created = store().saveTransaction(value);
    expect(store().transactions).toHaveLength(transactions.length + 1);
    expect(accountBalance(accounts[2], store().transactions)).toBe(70_000 - 25_000);

    const edited = store().saveTransaction({ ...value, amount: 30_000 }, created.id);
    expect(edited.id).toBe(created.id);
    expect(edited.createdAt).toBe(created.createdAt);
    expect(store().transactions.filter((item) => item.id === created.id)).toHaveLength(1);

    const deleted = store().deleteTransaction(created.id);
    expect(deleted?.removed.amount).toBe(30_000);
    expect(store().transactions.some((item) => item.id === created.id)).toBe(false);
    store().restoreTransactions(deleted!.restore);
    expect(store().transactions.some((item) => item.id === created.id)).toBe(true);
  });
});

describe('categories', () => {
  it('deleting a subcategory moves its entries to the parent', () => {
    store().deleteCategory('tea', null);
    expect(store().categories.some((item) => item.id === 'tea')).toBe(false);
    expect(store().transactions.find((item) => item.id === 't3')?.categoryId).toBe('food');
  });

  it('deleting a parent removes its subcategories and reassigns entries (same kind only)', () => {
    const previous = store().deleteCategory('food', 'rent');
    expect(store().categories.some((item) => item.id === 'tea')).toBe(false);
    expect(
      store()
        .transactions.filter((item) => item.categoryId === 'rent')
        .map((item) => item.id)
        .sort(),
    ).toEqual(['t2', 't3', 't4', 't6']);
    // Totals are preserved — nothing is lost, only re-labelled.
    expect(
      periodTotals(store().transactions, { start: '2026-10-01', end: '2026-10-31' }).expense,
    ).toBe(1_046_000);
    store().restoreLedger(previous);
    expect(store().transactions.find((item) => item.id === 't3')?.categoryId).toBe('tea');
  });

  it('undo restores only what the delete changed, keeping later additions', () => {
    const before = store().deleteCategory('food', 'rent');
    const after = getLedger();
    // Within the toast window: a new entry, an account, and one moved entry edited again.
    const added = store().saveTransaction({ ...store().transactions[0], note: 'later' });
    store().saveAccount({ name: 'New bank', group: 'bank', openingBalance: 0 });
    const t2 = store().transactions.find((item) => item.id === 't2')!;
    store().saveTransaction({ ...t2, categoryId: 'salary' }, 't2');
    store().restoreLedger(undoCategoryDelete(before, after, getLedger()));
    expect(store().categories.some((item) => item.id === 'food')).toBe(true);
    expect(store().categories.some((item) => item.id === 'tea')).toBe(true);
    expect(store().transactions.find((item) => item.id === 't3')?.categoryId).toBe('tea');
    expect(store().transactions.find((item) => item.id === 't2')?.categoryId).toBe('salary');
    expect(store().transactions.some((item) => item.id === added.id)).toBe(true);
    expect(store().accounts.some((item) => item.name === 'New bank')).toBe(true);
  });

  it('refuses to reassign to the wrong kind or to a deleted category', () => {
    store().deleteCategory('food', 'salary');
    expect(store().transactions.find((item) => item.id === 't4')?.categoryId).toBeNull();
    store().restoreLedger({ accounts, categories, transactions, people: [] });
    store().deleteCategory('food', 'tea');
    expect(store().transactions.find((item) => item.id === 't4')?.categoryId).toBeNull();
  });

  it('reorders siblings and keeps subcategories in step with the parent style', () => {
    store().moveCategory('rent', -1);
    const order = store()
      .categories.filter((item) => item.kind === 'expense' && item.parentId === null)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.id);
    expect(order).toEqual(['rent', 'food', 'gift']);
    store().saveCategory(
      { kind: 'expense', parentId: null, name: ' Food ', icon: 'coffee', tint: 5, budget: 600_000 },
      'food',
    );
    expect(store().categories.find((item) => item.id === 'food')).toMatchObject({
      name: 'Food',
      icon: 'coffee',
      budget: 600_000,
    });
    expect(store().categories.find((item) => item.id === 'tea')).toMatchObject({
      icon: 'coffee',
      tint: 5,
    });
  });

  it('adds subcategories at the end and never stores budgets on them', () => {
    const sub = store().saveCategory({
      kind: 'expense',
      parentId: 'food',
      name: 'Coffee',
      icon: 'food',
      tint: 3,
      budget: 100,
    });
    expect(sub.order).toBe(1);
    expect(sub.budget).toBeNull();
  });
});

describe('accounts', () => {
  it('only deletes accounts without transactions', () => {
    expect(store().deleteAccount('bank')).toBe(false);
    const fresh = store().saveAccount({ name: 'Wallet', group: 'wallet', openingBalance: 0 });
    expect(store().deleteAccount(fresh.id)).toBe(true);
  });
});

describe('people', () => {
  it('adds people, refuses duplicates, and records repayments as non-income', () => {
    const ravi = savePerson('Ravi') as { id: string; name: string };
    expect(ravi).toMatchObject({ name: 'Ravi' });
    expect(savePerson(' ravi ')).toBe('That name is already used here.');
    const before = periodTotals(store().transactions, { start: '2026-10-01', end: '2026-10-31' });
    const repayment = recordRepayment({
      personId: ravi.id,
      amount: 5_000,
      accountId: 'cash',
      date: '2026-10-08',
    });
    expect(repayment).toMatchObject({ kind: 'income', personId: ravi.id, categoryId: null });
    // Money arrives in the account but income stays the same.
    expect(periodTotals(store().transactions, { start: '2026-10-01', end: '2026-10-31' })).toEqual(
      before,
    );
    expect(deletePerson(ravi.id)).toBe(false);
    store().deleteTransaction(repayment.id);
    expect(deletePerson(ravi.id)).toBe(true);
  });

  it('deleting an expense unlinks the repayment made for it, and undo links it again', () => {
    const ravi = savePerson('Ravi') as { id: string };
    const dinner = store().saveTransaction({
      kind: 'expense',
      date: '2026-10-05',
      amount: 1_000,
      accountId: 'cash',
      toAccountId: null,
      fee: 0,
      categoryId: 'food',
      note: 'Dinner',
      splits: [{ personId: ravi.id, amount: 500 }],
    });
    const repayment = recordRepayment({
      personId: ravi.id,
      amount: 500,
      accountId: 'cash',
      settles: [dinner.id],
    });
    const deleted = store().deleteTransaction(dinner.id)!;
    const find = (id: string) => store().transactions.find((item) => item.id === id);
    // The database drops the link with the expense, so the app must not keep it.
    expect(find(repayment.id)?.settles).toEqual([]);
    store().restoreTransactions(deleted.restore);
    expect(find(dinner.id)).toBeDefined();
    expect(find(repayment.id)?.settles).toEqual([dinner.id]);
  });
});
