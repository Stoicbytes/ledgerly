import { buildExport } from '@/features/settings/exportAll';
import { fromRemote, type CloudData, type LedgerChanges } from '@/lib/data/ledgerRepository';
import { MAX_BATCH_ROWS, restoreBatches } from '@/lib/data/restoreBatches';
import { emptyData, sampleData, sampleSite, u } from '../__fixtures__/sample';
import { parseBackup, planRestore, withAdded } from '..';

type Row = Record<string, unknown>;

/** Stands in for the database: applies sync_ledger batches, answers load_ledger. */
function fakeServer() {
  const tables = new Map<string, Map<string, Row>>();
  const calls: LedgerChanges[] = [];
  const apply = (changes: LedgerChanges) => {
    calls.push(changes);
    for (const [key, rows] of Object.entries(changes)) {
      if (key === 'deleted') continue;
      expect((rows as Row[]).length).toBeLessThanOrEqual(MAX_BATCH_ROWS);
      const table = tables.get(key) ?? new Map<string, Row>();
      for (const row of rows as Row[])
        table.set(String(row.id), { ...row, updated_at: row.created_at });
      tables.set(key, table);
    }
  };
  const load = (): CloudData => {
    const rows = (key: string) => [...(tables.get(key)?.values() ?? [])];
    const transactions = rows('transactions');
    return fromRemote({
      ...Object.fromEntries(
        [
          'accounts',
          'categories',
          'people',
          'notes',
          'mf_funds',
          'mf_sips',
          'mf_transactions',
          'stocks',
          'stock_trades',
          'recurring',
          'goals',
          'employers',
          'payslips',
          'pf_entries',
        ].map((key) => [key, rows(key)]),
      ),
      transactions: transactions.map(({ splits: _s, settles: _t, ...row }) => row),
      splits: transactions.flatMap((t) =>
        (t.splits as Row[]).map((s) => ({ transaction_id: t.id, ...s })),
      ),
      settles: transactions.flatMap((t) =>
        (t.settles as string[]).map((id) => ({ repayment_id: t.id, expense_id: id })),
      ),
      note_extras: true,
    });
  };
  return { apply, load, calls };
}

/** Lists in id order (the real load_ledger sorts by its own columns). */
function sortedLists(data: CloudData) {
  const sort = (value: unknown): unknown =>
    Array.isArray(value)
      ? [...value].sort((a, b) => String(a.id).localeCompare(String(b.id)))
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sort(v)]))
        : value;
  return sort(data);
}

const fileOf = (data: CloudData, site: unknown = null) =>
  new TextEncoder().encode(JSON.stringify(buildExport(data, site), null, 2));

describe('restore from backup', () => {
  it('exports and restores into an empty account with identical data', () => {
    const data = sampleData();
    const backup = parseBackup(fileOf(data, sampleSite()));
    const server = fakeServer();
    const plan = planRestore(backup, server.load());
    expect(plan.total).toBe(23);
    restoreBatches(plan.add).forEach(server.apply);
    expect(sortedLists(server.load())).toEqual(sortedLists(data));
    // Preview restores into the stores the same way.
    expect(sortedLists(withAdded(emptyData(), plan.add))).toEqual(
      sortedLists({ ...data, noteExtras: undefined }),
    );
  });

  it('adds nothing when the same file is restored twice', () => {
    const backup = parseBackup(fileOf(sampleData()));
    const server = fakeServer();
    restoreBatches(planRestore(backup, server.load()).add).forEach(server.apply);
    const again = planRestore(backup, server.load());
    expect(again.total).toBe(0);
    expect(restoreBatches(again.add)).toEqual([]);
    expect(again.counts.transactions).toMatchObject({ inFile: 4, same: 4, add: 0 });
  });

  it('never overwrites: a record changed here is kept and reported', () => {
    const backup = parseBackup(fileOf(sampleData()));
    const current = sampleData();
    current.transactions[0] = { ...current.transactions[0], note: 'Edited here' };
    current.accounts.pop();
    const plan = planRestore(backup, current);
    expect(plan.counts.transactions).toMatchObject({ same: 3, changed: 1, add: 0 });
    expect(plan.add.accounts.map((a) => a.id)).toEqual([u(2)]);
    expect(plan.total).toBe(1);
  });

  it('uses an account or category with the same name instead of adding a second one', () => {
    const backup = parseBackup(fileOf(sampleData()));
    const current = emptyData();
    current.accounts = [{ id: u(500), name: ' cash ', group: 'cash', openingBalance: 0, order: 0 }];
    current.categories = [
      {
        id: u(510),
        kind: 'expense',
        parentId: null,
        name: 'Food',
        icon: 'food',
        tint: 0,
        budget: null,
        order: 0,
      },
    ];
    const plan = planRestore(backup, current);
    expect(plan.counts.accounts).toMatchObject({ matched: 1, add: 1 });
    expect(plan.counts.categories).toMatchObject({ matched: 1, add: 2 });
    const tea = plan.add.categories.find((c) => c.name === 'Tea');
    expect(tea?.parentId).toBe(u(510));
    const spent = plan.add.transactions.find((t) => t.id === u(30));
    expect(spent?.accountId).toBe(u(500));
    expect(plan.add.recurring?.[0].categoryId).toBe(u(510));
  });

  it('leaves out a payslip for a month that is already here under another id', () => {
    const backup = parseBackup(fileOf(sampleData()));
    const current = sampleData();
    current.payslips = [{ ...current.payslips![0], id: u(600) }];
    current.pfEntries = [];
    const plan = planRestore(backup, current);
    expect(plan.counts.payslips).toMatchObject({ clashes: 1, add: 0 });
    // Its PF contribution goes with it; the interest entry is added.
    expect(plan.counts.pfEntries).toMatchObject({ clashes: 1, add: 1 });
  });

  it('reports lists the database cannot keep yet instead of sending them', () => {
    const backup = parseBackup(fileOf(sampleData()));
    const current: CloudData = {
      ...emptyData(),
      payslips: undefined,
      pfEntries: undefined,
      employers: undefined,
    };
    const plan = planRestore(backup, current);
    expect(plan.unavailable).toEqual(['employers', 'payslips', 'pfEntries']);
    expect(restoreBatches(plan.add).some((b) => 'payslips' in b)).toBe(false);
  });

  it('sends large lists in batches of at most 4,000 rows, in a safe order', () => {
    const data = sampleData();
    const base = data.transactions[3];
    for (let i = 0; i < 9000; i += 1) {
      data.transactions.push({ ...base, id: u(10_000 + i), note: `Entry ${i}` });
    }
    const plan = planRestore(parseBackup(fileOf(data)), emptyData());
    const batches = restoreBatches(plan.add);
    const sizes = batches.filter((b) => b.transactions).map((b) => b.transactions!.length);
    expect(sizes).toEqual([4000, 4000, 1004]);
    const keys = batches.map((b) => Object.keys(b)[0]);
    expect(keys.indexOf('accounts')).toBeLessThan(keys.indexOf('transactions'));
    expect(keys.indexOf('transactions')).toBeLessThan(keys.indexOf('payslips'));
    expect(keys.lastIndexOf('payslips')).toBeLessThan(keys.indexOf('pf_entries'));
    // The repayment comes after the expense it settles.
    const order = batches.flatMap((b) => (b.transactions ?? []) as Row[]).map((r) => r.id);
    expect(order.indexOf(u(31))).toBeGreaterThan(order.indexOf(u(30)));
  });
});
