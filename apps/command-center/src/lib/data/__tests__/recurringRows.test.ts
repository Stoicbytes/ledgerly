import { EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { buildChanges, fromRemote, type CloudData } from '../ledgerRepository';

const row = {
  id: 'r1',
  kind: 'expense',
  amount: 1_500_000,
  account_id: 'a1',
  to_account_id: null,
  fee: 0,
  category_id: 'c1',
  note: 'Rent',
  frequency: 'monthly',
  start_date: '2026-01-31',
  next_date: '2026-02-28',
  created_at: '2026-01-31T10:00:00.000Z',
};

describe('recurring entries in the ledger', () => {
  it('reads them, and knows when the database has none yet (migration 0012)', () => {
    expect(fromRemote({ recurring: [row] }).recurring).toEqual([
      expect.objectContaining({
        id: 'r1',
        accountId: 'a1',
        nextDate: '2026-02-28',
        frequency: 'monthly',
      }),
    ]);
    expect(fromRemote({ recurring: [] }).recurring).toEqual([]);
    expect(fromRemote({}).recurring).toBeUndefined();
  });

  it('sends only changed rules, and never sends the key when unavailable', () => {
    const base = (): CloudData => fromRemote({ recurring: [row] });
    expect(buildChanges(base(), base())).toBeNull();
    const next = base();
    next.recurring = [{ ...next.recurring![0], nextDate: '2026-03-31' }];
    const changes = buildChanges(base(), next)!;
    expect(changes.recurring).toEqual([
      expect.objectContaining({ id: 'r1', next_date: '2026-03-31', created_at: row.created_at }),
    ]);
    next.recurring = [];
    expect(buildChanges(base(), next)!.deleted?.recurring).toEqual(['r1']);
    const without: CloudData = { ...fromRemote({}), portfolio: EMPTY_PORTFOLIO };
    expect(buildChanges(without, { ...without, notes: [] })).toBeNull();
  });
});
