import { buildChanges, fromRemote, type CloudData } from '../ledgerRepository';

const goal = {
  id: 'g1',
  name: 'House',
  target_amount: 5_000_000_00,
  target_date: '2032-04-01',
  expected_return: 10.5,
  created_at: '2026-10-01T00:00:00.000Z',
};
const fundRowIn = {
  id: 'f1',
  name: 'Fund',
  expense_ratio: 0.45,
  goal_id: 'g1',
  created_at: '2026-10-01T00:00:00.000Z',
};
const sipRowIn = {
  id: 's1',
  fund_id: 'f1',
  amount: 500_000,
  day_of_month: 5,
  start_date: '2026-01-05',
  step_up_pct: 10,
};

describe('goals, expense ratio and step-up in the ledger', () => {
  it('reads them, and knows when the database has no goals yet (migration 0013)', () => {
    const data = fromRemote({ goals: [goal], mf_funds: [fundRowIn], mf_sips: [sipRowIn] });
    expect(data.goals).toEqual([
      expect.objectContaining({ id: 'g1', targetAmount: 5_000_000_00, expectedReturn: 10.5 }),
    ]);
    expect(data.portfolio.funds[0]).toMatchObject({ expenseRatio: 0.45, goalId: 'g1' });
    expect(data.portfolio.sips[0]).toMatchObject({ stepUpPct: 10 });
    expect(fromRemote({}).goals).toBeUndefined();
    expect(fromRemote({ mf_funds: [{ id: 'f2', name: 'Old' }] }).portfolio.funds[0]).toMatchObject({
      expenseRatio: null,
      goalId: null,
    });
  });

  it('sends changed goals and the new fund and SIP settings', () => {
    const base = (): CloudData =>
      fromRemote({ goals: [goal], mf_funds: [fundRowIn], mf_sips: [sipRowIn] });
    expect(buildChanges(base(), base())).toBeNull();
    const next = base();
    next.goals = [{ ...next.goals![0], targetAmount: 6_000_000_00 }];
    next.portfolio = {
      ...next.portfolio,
      funds: [{ ...next.portfolio.funds[0], expenseRatio: 0.6, goalId: null }],
      sips: [{ ...next.portfolio.sips[0], stepUpPct: 5 }],
    };
    const changes = buildChanges(base(), next)!;
    expect(changes.goals).toEqual([expect.objectContaining({ target_amount: 6_000_000_00 })]);
    expect(changes.mf_funds).toEqual([
      expect.objectContaining({ expense_ratio: 0.6, goal_id: null }),
    ]);
    expect(changes.mf_sips).toEqual([expect.objectContaining({ step_up_pct: 5 })]);
    next.goals = [];
    expect(buildChanges(base(), next)!.deleted?.goals).toEqual(['g1']);
  });
});
