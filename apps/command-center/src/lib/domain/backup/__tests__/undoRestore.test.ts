import { emptyData, sampleData, u } from '../__fixtures__/sample';
import { addedIds, planRestore, withAdded, withoutRestored } from '..';

const backupOf = (data = sampleData()) => ({
  exportedAt: '2026-10-13T00:00:00Z',
  data,
  site: null,
});

describe('undoing a restore', () => {
  it('removes exactly what the restore added', () => {
    const before = emptyData();
    before.accounts = [
      { id: u(700), name: 'Wallet', group: 'wallet', openingBalance: 0, order: 0 },
    ];
    const plan = planRestore(backupOf(), before);
    const restored = withAdded(before, plan.add);
    const undone = withoutRestored(restored, addedIds(plan.add));
    expect(undone.accounts).toEqual(before.accounts);
    expect(undone.transactions).toEqual([]);
    expect(undone.portfolio).toEqual(before.portfolio);
    expect(undone.payslips).toEqual([]);
    expect(undone.notes).toEqual([]);
  });

  it('keeps restored records something added since still uses', () => {
    const plan = planRestore(backupOf(), emptyData());
    const restored = withAdded(emptyData(), plan.add);
    const later = { ...restored.transactions[3], id: u(800), categoryId: null };
    restored.transactions = [...restored.transactions, later];
    restored.portfolio = {
      ...restored.portfolio,
      trades: [...restored.portfolio.trades, { ...restored.portfolio.trades[0], id: u(801) }],
    };
    const undone = withoutRestored(restored, addedIds(plan.add));
    expect(undone.transactions.map((t) => t.id)).toEqual([u(800)]);
    expect(undone.accounts.map((a) => a.id)).toEqual([u(2)]);
    expect(undone.portfolio.stocks.map((s) => s.id)).toEqual([u(90)]);
    expect(undone.portfolio.funds).toEqual([]);
    expect(undone.categories).toEqual([]);
  });
});
