import { pfInsights } from '@/lib/domain/insights';
import { pf, slip } from '../__fixtures__/salary';

const entries = [
  pf('2024-06-01', { kind: 'opening', employee: 1_00_000_00, employer: 80_000_00 }),
  pf('2025-03-31', { kind: 'interest', employee: 5_000_00, employer: 4_000_00, rate: 8.25 }),
  // FY 2025-26: contributions, no interest entered
  pf('2025-10-01', { employee: 6_000_00, employer: 4_750_00 }),
  // this financial year (FY 2026-27): two months in
  pf('2026-04-01', { employee: 6_000_00, employer: 4_750_00, pension: 1_250_00 }),
  pf('2026-05-01', { employee: 6_000_00, vpf: 2_000_00, employer: 4_750_00 }),
];

describe('PF insights', () => {
  it('asks for missing interest and says how much the balance grew this year', () => {
    const list = pfInsights(entries, [], '2026-10-21');
    expect(list.find((item) => item.id === 'pf-interest')).toEqual({
      id: 'pf-interest',
      tone: 'info',
      title: 'Add FY 2025-26 PF interest from your passbook',
      detail: 'Not entered yet for FY 2025-26, so your PF balance reads lower than the passbook.',
    });
    // 10,750 + 12,750 since 31 March; 1,80,000 + 9,000 + 10,750 + 23,500 now
    expect(list.find((item) => item.id === 'pf-growth')).toMatchObject({
      tone: 'good',
      title: 'PF grew ₹23,500 this financial year',
      detail:
        "₹2,23,250 now, your share and the employer's (FY 2026-27; interest counts once credited).",
    });
  });

  it('counts several years of missing interest', () => {
    const old = [pf('2023-06-01', { kind: 'opening', employee: 50_000_00 })];
    expect(pfInsights(old, [], '2026-10-21')[0].title).toBe(
      'Add PF interest for 3 years from your passbook',
    );
  });

  it('flags recent payslips with PF but no employer share', () => {
    const slips = [
      slip('2026-06'),
      slip('2026-07', { employerEpf: 0, employerEps: 0 }),
      slip('2026-08', { employerEpf: 0, employerEps: 0 }),
      slip('2026-09'),
      slip('2026-01', { employerEpf: 0, employerEps: 0 }), // older than the newest three
    ];
    expect(pfInsights([], slips, '2026-10-21')).toEqual([
      {
        id: 'pf-employer',
        tone: 'info',
        title: 'Employer PF share missing on 2 recent payslips',
        detail:
          'July 2026, August 2026. Add it from the payslip or passbook (the payslip form can estimate it).',
      },
    ]);
  });

  it('says nothing without PF', () => {
    expect(pfInsights([], [slip('2026-09')], '2026-10-21')).toEqual([]);
  });
});
