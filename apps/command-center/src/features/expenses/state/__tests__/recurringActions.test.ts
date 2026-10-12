import { accounts, categories, transactions } from '@/lib/domain/expenses/__fixtures__/ledger';
import { useExpenseStore } from '../expenseStore';
import {
  addAllDue,
  advanceRule,
  createRule,
  deleteRule,
  dueEntryValue,
  restoreRule,
  updateRule,
} from '../recurringActions';
import { useRecurringStore } from '../recurringStore';

const rules = () => useRecurringStore.getState().rules;
const entry = {
  kind: 'expense' as const,
  date: '2026-08-31',
  amount: 1_500_000,
  accountId: 'bank',
  toAccountId: null,
  fee: 0,
  categoryId: 'rent',
  note: 'Rent',
  splits: [],
};

beforeEach(() => {
  useExpenseStore.getState().restoreLedger({ accounts, categories, transactions, people: [] });
  useRecurringStore.setState({ rules: [], available: true });
});

describe('recurring actions', () => {
  it('makes an entry repeat from its date and moves on as dates are handled', () => {
    const rule = createRule(entry, 'monthly');
    expect(rule).toMatchObject({
      startDate: '2026-08-31',
      nextDate: '2026-09-30',
      amount: 1_500_000,
    });
    advanceRule(rule.id, '2026-09-30');
    expect(rules()[0].nextDate).toBe('2026-10-31');
    // An older date never moves it back.
    advanceRule(rule.id, '2026-09-30');
    expect(rules()[0].nextDate).toBe('2026-10-31');
  });

  it('adds everything due at once, and Undo takes it all back', () => {
    createRule({ ...entry, date: '2026-08-05' }, 'monthly');
    const before = useExpenseStore.getState().transactions.length;
    const { added, undo } = addAllDue('2026-10-11');
    expect(added.map((item) => item.date)).toEqual(['2026-09-05', '2026-10-05']);
    expect(added[0]).toMatchObject({ amount: 1_500_000, categoryId: 'rent', note: 'Rent' });
    expect(rules()[0].nextDate).toBe('2026-11-05');
    undo();
    expect(useExpenseStore.getState().transactions).toHaveLength(before);
    expect(rules()[0].nextDate).toBe('2026-09-05');
  });

  it('leaves a due date whose category is gone for you to finish by hand', () => {
    const rule = createRule({ ...entry, date: '2026-09-01' }, 'monthly');
    useExpenseStore.getState().deleteCategory('rent', null);
    expect(dueEntryValue({ rule: rules()[0], date: '2026-10-01' })).toBeNull();
    expect(addAllDue('2026-10-11').added).toEqual([]);
    // The rule forgets the deleted category, as the database does.
    advanceRule(rule.id, '2026-10-01');
    expect(rules()[0].categoryId).toBeNull();
  });

  it('changes amount and rhythm from the next date, and deletes with Undo', () => {
    const rule = createRule(entry, 'monthly');
    updateRule(rule.id, {
      amount: 1_600_000,
      note: 'Rent',
      frequency: 'weekly',
      nextDate: '2026-10-02',
    });
    expect(rules()[0]).toMatchObject({
      amount: 1_600_000,
      frequency: 'weekly',
      startDate: '2026-10-02',
    });
    const removed = deleteRule(rule.id)!;
    expect(rules()).toEqual([]);
    restoreRule(removed);
    expect(rules()).toHaveLength(1);
  });

  it('keeps an account a recurring entry uses', () => {
    const fresh = useExpenseStore
      .getState()
      .saveAccount({ name: 'Wallet', group: 'wallet', openingBalance: 0 });
    createRule({ ...entry, accountId: fresh.id }, 'weekly');
    expect(useExpenseStore.getState().deleteAccount(fresh.id)).toBe(false);
  });
});
