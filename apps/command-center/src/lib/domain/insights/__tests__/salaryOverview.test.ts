import { payByMonth, pfBalanceByMonth, pfHistory, salaryOverview } from '@/lib/domain/insights';
import { pfBalance } from '@/lib/domain/salary';
import { pay, pf, slip } from '../__fixtures__/salary';

describe('pay by month', () => {
  it('adds employers together, starts at the first payslip and keeps gaps at zero', () => {
    const list = payByMonth([
      slip('2026-06', pay(50_000_00)),
      slip('2026-06', { ...pay(20_000_00), employerId: 'e2', tds: 1_000_00 }),
      slip('2026-08', pay(50_000_00)),
      slip('2024-01'), // outside the 12 months
    ]);
    expect(list.map((item) => [item.month, item.gross, item.tds, item.slips])).toEqual([
      ['2026-06', 70_000_00, 6_000_00, 2],
      ['2026-07', 0, 0, 0],
      ['2026-08', 50_000_00, 5_000_00, 1],
    ]);
    // net = gross − 200 PT − 6,000 EPF − TDS
    expect(list[2].net).toBe(50_000_00 - 200_00 - 6_000_00 - 5_000_00);
    expect(payByMonth([])).toEqual([]);
  });
});

describe('PF balance by month', () => {
  const entries = [
    pf('2026-01-15', { kind: 'opening', employee: 1_00_000_00, employer: 50_000_00 }),
    pf('2026-03-01', { employee: 6_000_00, employer: 4_000_00, pension: 1_250_00 }),
    pf('2026-04-20', { kind: 'withdrawal', employee: 20_000_00 }),
    pf('2026-06-01', { employee: 6_000_00, employer: 4_000_00 }),
  ];

  it('matches pfBalance at each month end and counts later entries in the last month', () => {
    const months = ['2026-02', '2026-03', '2026-04', '2026-05'];
    expect(pfBalanceByMonth(entries, months)).toEqual([
      pfBalance(entries, '2026-02-28').total,
      pfBalance(entries, '2026-03-31').total,
      pfBalance(entries, '2026-04-30').total,
      pfBalance(entries).total,
    ]);
    expect(pfBalanceByMonth(entries, months)).toEqual([
      1_50_000_00, 1_60_000_00, 1_40_000_00, 1_50_000_00,
    ]);
  });

  it('starts the history at the first entry', () => {
    const history = pfHistory(entries, '2026-07-10');
    expect(history.map((item) => item.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ]);
    expect(history[history.length - 1].balance).toBe(1_50_000_00);
    expect(pfHistory([], '2026-07-10')).toEqual([]);
  });
});

describe('salary overview', () => {
  it('gives the newest pay, this year’s totals, the TDS rate and the PF growth', () => {
    const view = salaryOverview(
      [slip('2026-03', { tds: 9_000_00 }), slip('2026-04'), slip('2026-05')],
      [
        pf('2025-12-01', { kind: 'opening', employee: 1_00_000_00 }),
        pf('2026-04-01', { employee: 6_000_00, employer: 4_750_00, pension: 1_250_00 }),
      ],
      '2026-06-10',
    );
    expect(view.latest).toMatchObject({ gross: 75_000_00, net: 63_800_00 });
    expect(view.latest?.slip.month).toBe('2026-05');
    expect(view.year).toMatchObject({ fy: 'FY 2026-27', gross: 1_50_000_00, tds: 10_000_00 });
    // 10,000 ÷ 1,50,000
    expect(view.tdsRate).toBeCloseTo(0.0667, 4);
    expect(view.pf).toMatchObject({ total: 1_10_750_00, pension: 1_250_00 });
    expect(view.pfGrowth).toBe(10_750_00);
    expect(view.pay).toHaveLength(3);
  });

  it('falls back to the newest year with payslips and copes with nothing at all', () => {
    expect(salaryOverview([slip('2026-02')], [], '2026-06-10').year?.fy).toBe('FY 2025-26');
    const empty = salaryOverview([], [], '2026-06-10');
    expect(empty).toMatchObject({
      latest: null,
      year: null,
      tdsRate: null,
      pay: [],
      pfHistory: [],
    });
  });
});
