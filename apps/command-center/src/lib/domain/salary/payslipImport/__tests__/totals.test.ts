import { estimateEmployerShare } from '../..';
import { checkTotals, detectFromRows, type DetectedPayslip } from '..';

describe('spreadsheets', () => {
  it('reads a two-column label / amount sheet', () => {
    const [slip] = detectFromRows([
      ['Company', 'Example Works Pvt Ltd'],
      ['Pay month', 'Sep-2026'],
      ['Basic', 30000],
      ['Employee PF', 3600],
      ['Net Pay', 26400],
    ]);
    expect(slip).toMatchObject({
      month: '2026-09',
      employerName: 'Example Works Pvt Ltd',
      earnings: [{ label: 'Basic', amount: 30_000_00 }],
      epfEmployee: 3_600_00,
      printed: { net: 26_400_00 },
    });
  });

  it('reads one payslip per row from a payroll export', () => {
    const slips = detectFromRows([
      ['Month', 'Company', 'Basic', 'HRA', 'PF', 'TDS', 'Net Pay'],
      [46235, 'Example Works', 30000, 12000, 3600, 2000.5, 36399.5],
      ['Sep-2026', 'Example Works', 30000, 12000, 3600, 2000, 36400],
    ]);
    expect(slips.map((slip) => [slip.month, slip.employerName, slip.tds])).toEqual([
      ['2026-08', 'Example Works', 2_000_50],
      ['2026-09', 'Example Works', 2_000_00],
    ]);
    expect(checkTotals(slips[1])).toEqual([]);
  });
});

describe('checkTotals and the employer estimate', () => {
  const slip: DetectedPayslip = {
    month: '2026-09',
    paidOn: null,
    employerName: 'Example Works',
    earnings: [{ label: 'Basic', amount: 30_000_00 }],
    deductions: [{ label: 'PT', amount: 200_00 }],
    epfEmployee: 3_600_00,
    vpf: 0,
    tds: 1_000_00,
    employerEpf: null,
    employerEps: null,
    printed: { gross: 30_000_00, deductions: 4_800_00, net: 25_200_00 },
    unsure: [],
  };

  it('accepts totals within ₹1 and explains each mismatch', () => {
    expect(checkTotals(slip)).toEqual([]);
    expect(
      checkTotals({ ...slip, printed: { gross: 30_000_99, deductions: null, net: 25_200_50 } }),
    ).toEqual([]);
    expect(
      checkTotals({ ...slip, printed: { gross: 32_000_00, deductions: 5_000_00, net: 25_000_00 } }),
    ).toEqual([
      'Earnings add up to ₹30,000.00, but the payslip says gross ₹32,000.00.',
      'Deductions add up to ₹4,800.00, but the payslip says ₹5,000.00.',
      'Net pay works out to ₹25,200.00, but the payslip says ₹25,000.00.',
    ]);
    expect(
      checkTotals({ ...slip, month: null, printed: { gross: null, deductions: null, net: null } }),
    ).toEqual(['The pay month was not found.', 'No totals are printed to check against.']);
  });

  it('estimates the employer share by the statutory rule', () => {
    expect(estimateEmployerShare(5_400_00)).toEqual({
      employerEpf: 4_150_00,
      employerEps: 1_250_00,
    });
    expect(estimateEmployerShare(1_200_00)).toEqual({ employerEpf: 367_00, employerEps: 833_00 });
    expect(estimateEmployerShare(0)).toEqual({ employerEpf: 0, employerEps: 0 });
  });
});
