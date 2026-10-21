import {
  lastSalaryInsight,
  missingPayslipInsight,
  salaryChangeInsight,
  tdsInsight,
} from '@/lib/domain/insights';
import type { Employer } from '@/lib/domain/salary';
import { pay, slip } from '../__fixtures__/salary';

const employer = (leftOn: string | null = null): Employer => ({
  id: 'e1',
  name: 'Employer',
  joinedOn: null,
  leftOn,
  note: '',
  createdAt: 0,
});

describe('salary change', () => {
  it('spots a raise against the month before, with the year-ago figure', () => {
    const insight = salaryChangeInsight([
      slip('2025-04', pay(60_000_00)),
      slip('2026-03', pay(62_500_00)),
      slip('2026-04', pay(70_000_00)),
    ]);
    // 70,000 against 62,500: up 12%; against 60,000 a year ago: 17% more
    expect(insight).toEqual({
      id: 'salary-change',
      tone: 'good',
      title: 'Gross pay up 12% from March',
      detail: '₹70,000 for April 2026, against ₹62,500. 17% more than April 2025.',
    });
  });

  it('points out an unusually low month and the allowance that is missing', () => {
    const low = slip('2026-09', {
      earnings: [
        { label: 'Basic', amount: 50_000_00 },
        { label: 'HRA', amount: 15_000_00 },
      ],
    });
    // 65,000 against 75,000: 13% lower
    expect(salaryChangeInsight([slip('2026-08'), low])).toMatchObject({
      tone: 'info',
      title: 'September gross pay was 13% lower than August',
      detail: '₹65,000 against ₹75,000. No Special allowance this time.',
    });
  });

  it('compares with a year ago when the month before is the same', () => {
    expect(
      salaryChangeInsight([
        slip('2025-09', pay(66_000_00)),
        slip('2026-08', pay(75_000_00)),
        slip('2026-09', pay(75_000_00)),
      ]),
    ).toMatchObject({ tone: 'good', title: 'Gross pay is 14% higher than a year ago' });
  });

  it('says nothing for small changes, another employer or a single payslip', () => {
    expect(salaryChangeInsight([slip('2026-08'), slip('2026-09', pay(76_000_00))])).toBeNull();
    expect(
      salaryChangeInsight([slip('2026-08', pay(40_000_00)), slip('2026-09', { employerId: 'e2' })]),
    ).toBeNull();
    expect(salaryChangeInsight([slip('2026-09')])).toBeNull();
    expect(salaryChangeInsight([])).toBeNull();
  });
});

describe('missing payslip', () => {
  const slips = [slip('2026-07'), slip('2026-08')];

  it('asks for the next payslip once the last month ended more than 45 days ago', () => {
    // 31 Aug + 45 days = 15 Oct
    expect(missingPayslipInsight(slips, [employer()], '2026-10-15')).toBeNull();
    expect(missingPayslipInsight(slips, [employer()], '2026-10-16')).toEqual({
      id: 'payslip-missing',
      tone: 'warn',
      title: 'No payslip for September yet',
      detail: 'The last one is for August 2026. Import it on Salary & PF.',
    });
  });

  it('stays quiet after leaving the job or after a long break', () => {
    expect(missingPayslipInsight(slips, [employer('2026-09-15')], '2026-10-21')).toBeNull();
    expect(missingPayslipInsight(slips, [employer()], '2027-03-01')).toBeNull();
    expect(missingPayslipInsight([], [], '2026-10-21')).toBeNull();
  });
});

describe('TDS', () => {
  it('adds the newest month’s TDS for each month left to March', () => {
    const slips = [
      slip('2026-03', { tds: 9_000_00 }), // last financial year: left out
      slip('2026-04', { tds: 5_000_00 }),
      slip('2026-05', { tds: 5_000_00 }),
      slip('2026-06', { tds: 6_000_00 }),
    ];
    // 16,000 so far + 9 months (Jul–Mar) × 6,000 = 70,000
    expect(tdsInsight(slips, '2026-07-10')).toEqual({
      id: 'tds',
      tone: 'info',
      title: 'About ₹70,000 tax (TDS) by March at this rate',
      detail: '₹16,000 deducted so far in FY 2026-27; ₹6,000 on the June payslip, 9 months to go.',
    });
  });

  it('gives the year’s total once March is in, and nothing without TDS', () => {
    const march = [slip('2026-02'), slip('2026-03')];
    expect(tdsInsight(march, '2026-03-31')?.title).toBe('₹10,000 tax (TDS) deducted in FY 2025-26');
    expect(tdsInsight([slip('2026-05', { tds: 0 })], '2026-06-01')).toBeNull();
    expect(tdsInsight([slip('2026-03')], '2026-06-01')).toBeNull();
  });
});

it('keeps the last salary line: net pay, gross and tax', () => {
  // 75,000 − 200 − 6,000 − 5,000
  expect(lastSalaryInsight([slip('2026-08'), slip('2026-09')])).toMatchObject({
    title: 'Last salary ₹63,800 for Sept',
    detail: 'Gross ₹75,000, tax deducted ₹5,000.',
  });
});
