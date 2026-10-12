import { accounts, categories, transactions } from '@/lib/domain/expenses/__fixtures__/ledger';
import { useExpenseStore } from '../expenseStore';
import { nextField, useTransactionForm } from '../transactionForm';

const form = () => useTransactionForm.getState();

beforeEach(() => {
  useExpenseStore.getState().restoreLedger({ accounts, categories, transactions, people: [] });
  useTransactionForm.setState({
    open: false,
    editingId: null,
    errors: {},
    active: null,
    last: { kind: 'expense', accountId: null },
  });
});

describe('fast entry flow', () => {
  it('opens on the amount with sensible defaults', () => {
    form().openNew({ date: '2026-10-03' });
    expect(form()).toMatchObject({ open: true, active: 'amount', editingId: null });
    expect(form().draft).toMatchObject({
      kind: 'expense',
      date: '2026-10-03',
      amountText: '',
      categoryId: null,
    });
  });

  it('advances amount → category → account → note', () => {
    form().openNew();
    form().update({ amountText: '120' });
    form().advance('amount');
    expect(form().active).toBe('category');
    form().choose('category', 'tea');
    expect(form().active).toBe('account');
    form().choose('account', 'cash');
    expect(form().active).toBe('note');
  });

  it('skips fields that already have a value', () => {
    const draft = {
      kind: 'expense' as const,
      date: '2026-10-03',
      amountText: '5',
      categoryId: 'tea',
      accountId: 'cash',
      toAccountId: null,
      feeText: '',
      note: '',
      splits: [],
      splitMode: 'equal' as const,
      myShareText: '',
      personId: null,
      photo: null,
    };
    expect(nextField(draft, 'amount')).toBe('note');
    expect(nextField({ ...draft, kind: 'transfer', accountId: null }, 'amount')).toBe('account');
    expect(nextField({ ...draft, kind: 'transfer', toAccountId: null }, 'account')).toBe(
      'toAccount',
    );
    expect(nextField(draft, 'note')).toBeNull();
  });

  it('shows errors and focuses the first invalid field', () => {
    form().openNew();
    const result = form().submit('save');
    expect(result.ok).toBe(false);
    expect(form().active).toBe('amount');
    expect(Object.keys(form().errors).sort()).toEqual(['account', 'amount', 'category']);
    form().update({ amountText: '10' });
    expect(form().errors.amount).toBeUndefined();
  });

  it('saves, remembers type and account, and Continue keeps date/account', () => {
    form().openNew({ date: '2026-10-04' });
    form().update({ amountText: '60', categoryId: 'tea', accountId: 'cash', note: 'Tea' });
    const result = form().submit('continue');
    expect(result.ok).toBe(true);
    expect(form()).toMatchObject({ open: true, active: 'amount' });
    expect(form().draft).toMatchObject({
      date: '2026-10-04',
      accountId: 'cash',
      amountText: '',
      categoryId: null,
      note: '',
    });
    expect(useExpenseStore.getState().transactions).toHaveLength(transactions.length + 1);

    form().close();
    form().openNew();
    expect(form().draft.accountId).toBe('cash');
  });

  it('adds an entry once even if Save is tapped twice while the sheet closes', () => {
    form().openNew({ date: '2026-10-04' });
    form().update({ amountText: '60', categoryId: 'tea', accountId: 'cash' });
    expect(form().submit('save').ok).toBe(true);
    expect(form().submit('save').ok).toBe(false);
    expect(useExpenseStore.getState().transactions).toHaveLength(transactions.length + 1);
  });

  it('switching type clears the kind-specific category', () => {
    form().openNew();
    form().update({ categoryId: 'tea' });
    form().setKind('income');
    expect(form().draft.categoryId).toBeNull();
  });
});

describe('editing', () => {
  it('loads a transaction and saves changes in place', () => {
    const original = transactions.find((item) => item.id === 't5')!;
    form().openEdit(original);
    expect(form().draft).toMatchObject({
      kind: 'transfer',
      amountText: '2000',
      feeText: '10',
      toAccountId: 'card',
    });
    form().update({ feeText: '' });
    const result = form().submit('save');
    expect(result.ok && result.created).toBe(false);
    expect(result.ok && result.previous?.fee).toBe(1_000);
    expect(useExpenseStore.getState().transactions.find((item) => item.id === 't5')?.fee).toBe(0);
    expect(form().open).toBe(false);
  });
});
