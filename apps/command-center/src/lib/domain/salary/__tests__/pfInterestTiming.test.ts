import { estimateInterest, type PfEntry } from '..';

const contribution = (date: string, employee: number): PfEntry => ({
  id: date,
  kind: 'contribution',
  date,
  employerId: 'e1',
  payslipId: null,
  employee,
  vpf: 0,
  employer: 0,
  pension: 0,
  rate: null,
  note: '',
  createdAt: 0,
});

describe('PF interest estimate timing', () => {
  it('counts a contribution from the month after its wage month', () => {
    // March wages are deposited in April: no interest in the year they are for
    expect(estimateInterest([contribution('2025-03-01', 12_000_00)], 'FY 2024-25', 8.25)).toBe(0);
    // April wages earn from May: 11 months × 12,000 × 8.25 / 1200 = 907.50 → 908
    expect(estimateInterest([contribution('2024-04-01', 12_000_00)], 'FY 2024-25', 8.25)).toBe(
      908_00,
    );
    // Last year's March wages are in the opening balance: all 12 months
    expect(estimateInterest([contribution('2024-03-01', 12_000_00)], 'FY 2024-25', 8.25)).toBe(
      990_00,
    );
  });
});
