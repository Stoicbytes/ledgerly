import type { Transaction } from '@/lib/domain/expenses';
import { buildChanges, fromRemote, type CloudData } from '../ledgerRepository';

const remote = {
  accounts: [
    { id: 'a1', name: 'Cash', account_group: 'cash', opening_balance: 50000, sort_order: 0 },
  ],
  categories: [
    {
      id: 'c1',
      kind: 'expense',
      parent_id: null,
      name: 'Food',
      icon: 'food',
      tint: 1,
      budget: 600000,
      sort_order: 0,
    },
    {
      id: 'c2',
      kind: 'expense',
      parent_id: 'c1',
      name: 'Tea',
      icon: 'food',
      tint: 1,
      budget: null,
      sort_order: 0,
    },
  ],
  people: [{ id: 'p1', name: 'Arun', sort_order: 0 }],
  transactions: [
    {
      id: 't1',
      kind: 'expense',
      occurred_on: '2026-10-01',
      amount: 120000,
      account_id: 'a1',
      to_account_id: null,
      fee: 0,
      category_id: 'c2',
      note: 'Dinner',
      person_id: null,
      created_at: '2026-10-01T10:00:00Z',
    },
    {
      id: 't2',
      kind: 'income',
      occurred_on: '2026-10-02',
      amount: 40000,
      account_id: 'a1',
      to_account_id: null,
      fee: 0,
      category_id: null,
      note: '',
      person_id: 'p1',
      created_at: '2026-10-02T10:00:00Z',
    },
  ],
  splits: [{ transaction_id: 't1', person_id: 'p1', amount: 40000 }],
  settles: [{ repayment_id: 't2', expense_id: 't1' }],
  notes: [
    {
      id: 'n1',
      title: 'List',
      body: '',
      items: [{ id: 'x', text: 'Milk', done: false }],
      color: 'mint',
      pinned: true,
      archived: false,
      labels: ['home'],
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-02T00:00:00Z',
    },
  ],
};

describe('fromRemote', () => {
  it('maps rows to the app types, with splits and settles on their transactions', () => {
    const data = fromRemote(remote);
    expect(data.accounts[0]).toEqual({
      id: 'a1',
      name: 'Cash',
      group: 'cash',
      openingBalance: 50000,
      order: 0,
    });
    expect(data.categories[1]).toMatchObject({ id: 'c2', parentId: 'c1', budget: null });
    expect(data.transactions[0]).toMatchObject({
      date: '2026-10-01',
      categoryId: 'c2',
      splits: [{ personId: 'p1', amount: 40000 }],
      createdAt: Date.parse('2026-10-01T10:00:00Z'),
    });
    expect(data.transactions[1]).toMatchObject({ personId: 'p1', settles: ['t1'] });
    expect(data.notes[0]).toMatchObject({ color: 'mint', pinned: true, labels: ['home'] });
  });

  it('copes with an empty or missing response', () => {
    expect(fromRemote(null)).toEqual({
      noteExtras: false,
      accounts: [],
      categories: [],
      people: [],
      transactions: [],
      portfolio: { funds: [], fundTxns: [], sips: [], stocks: [], trades: [] },
      notes: [],
    });
  });
});

describe('buildChanges', () => {
  const base = (): CloudData => fromRemote(remote);

  it('is null when nothing stored changed (a picked photo not uploaded is not stored)', () => {
    const next = base();
    next.transactions[0] = {
      ...next.transactions[0],
      photo: { uri: 'blob:x', width: 1, height: 1, mimeType: 'image/jpeg', bytes: 1 },
    } as Transaction;
    expect(buildChanges(base(), next)).toBeNull();
  });

  it('sends edited rows with their splits, and deletions', () => {
    const next = base();
    next.transactions[0] = { ...next.transactions[0], amount: 90000, splits: [] };
    next.notes = [];
    const changes = buildChanges(base(), next)!;
    expect(changes.transactions).toEqual([
      expect.objectContaining({
        id: 't1',
        amount: 90000,
        occurred_on: '2026-10-01',
        splits: [],
        settles: [],
      }),
    ]);
    expect(changes.deleted?.notes).toEqual(['n1']);
    expect(changes.accounts).toEqual([]);
    expect(JSON.stringify(changes)).not.toContain('user_id');
  });

  it('ignores the key order the database gives checklist items', () => {
    const next = base();
    next.notes[0] = { ...next.notes[0], items: [{ done: false, text: 'Milk', id: 'x' } as never] };
    expect(buildChanges(base(), next)).toBeNull();
  });

  it('sends new rows in the database column names', () => {
    const next = base();
    next.accounts.push({ id: 'a2', name: 'Bank', group: 'bank', openingBalance: 0, order: 1 });
    expect(buildChanges(base(), next)?.accounts).toEqual([
      { id: 'a2', name: 'Bank', account_group: 'bank', opening_balance: 0, sort_order: 1 },
    ]);
  });
});
