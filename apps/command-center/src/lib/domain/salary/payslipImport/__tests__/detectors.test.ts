import type { Employer } from '../../types';
import {
  classifyLabel,
  dateIn,
  detectEmployer,
  detectMonth,
  detectPaidOn,
  isIdentityLabel,
  matchEmployer,
  normaliseEmployerName,
  parsePrintedAmount,
} from '..';
import { line } from '../__fixtures__/textLines';

describe('parsePrintedAmount', () => {
  it.each([
    ['₹ 1,23,456.00', 1_23_456_00],
    ['Rs. 12,500', 12_500_00],
    ['Rs.12,500', 12_500_00],
    ['INR 12500', 12_500_00],
    ['12,500.00 Cr', 12_500_00],
    ['12,500/-', 12_500_00],
    ['123,456.5', 1_23_456_50],
    ['0', 0],
  ])('%s → %d paise', (text, paise) => {
    expect(parsePrintedAmount(text)).toBe(paise);
  });

  it.each(['01/09/2026', '12%', '1.234', 'EMP-0001', '-500', 'Basic', '1,2,3'])(
    'refuses %s',
    (text) => {
      expect(parsePrintedAmount(text)).toBeNull();
    },
  );
});

describe('detectMonth and the pay date', () => {
  it.each([
    ['Payslip for the month of September 2026', '2026-09'],
    ['Pay Period: 01/09/2026 - 30/09/2026', '2026-09'],
    ['Pay slip for Sep-2026', '2026-09'],
    ['Salary for September, 2026', '2026-09'],
    ["Salary slip for Sep'26", '2026-09'],
    ['Month: 09/2026', '2026-09'],
  ])('%s → %s (sure)', (text, month) => {
    expect(detectMonth(['Example Technologies Pvt Ltd', text])).toEqual({
      month,
      confidence: 'high',
    });
  });

  it('skips joining, birth and payment dates, and is unsure of a stray month', () => {
    expect(
      detectMonth(['Date of Joining: 01/06/2023', 'Pay Date: 01/10/2026', 'Sep 2026']),
    ).toEqual({ month: '2026-09', confidence: 'low' });
    expect(detectMonth(['Date of Joining: Jun 2023'])).toBeNull();
  });

  it('reads the pay date in Indian formats', () => {
    expect(detectPaidOn(['Pay Date: 30/09/2026'])).toBe('2026-09-30');
    expect(detectPaidOn(['Salary credited on 1 Oct 2026'])).toBe('2026-10-01');
    expect(detectPaidOn(['Paid on: Sep 30, 2026'])).toBe('2026-09-30');
    expect(detectPaidOn(['Date of Joining: 01/06/2023'])).toBeNull();
    expect(dateIn('31/02/2026')).toBeNull();
  });
});

describe('employer', () => {
  it('takes the company line at the top, cut after its suffix', () => {
    const lines = [
      line([[40, 'Example Technologies Pvt. Ltd., 4th Floor, Example Road']], 800, 16),
      line([[40, 'Payslip for September 2026']], 780),
    ];
    expect(detectEmployer(lines)).toEqual({
      name: 'Example Technologies Pvt. Ltd.',
      confidence: 'high',
    });
  });

  it('prefers a "Company:" line, and is unsure of a bare heading', () => {
    expect(detectEmployer([line([[40, 'Company Name: Sample Works']])])?.name).toBe('Sample Works');
    const plain = [line([[40, 'Payslip']], 800, 16), line([[40, 'Sample Works']], 780, 14)];
    expect(detectEmployer(plain)).toEqual({ name: 'Sample Works', confidence: 'low' });
  });

  it('never takes an identity line as the name', () => {
    expect(detectEmployer([line([[40, 'Employee ID: EMP-0001']], 800, 18)])).toBeNull();
  });

  const employer = (id: string, name: string): Employer => ({
    id,
    name,
    joinedOn: null,
    leftOn: null,
    note: '',
    createdAt: 0,
  });

  it('matches existing employers whatever the case, punctuation or Pvt Ltd spelling', () => {
    const employers = [
      employer('e1', 'Example Technologies Private Limited'),
      employer('e2', 'Sample LLP'),
    ];
    expect(normaliseEmployerName('EXAMPLE TECHNOLOGIES PVT. LTD.')).toBe(
      'example technologies pvt ltd',
    );
    expect(matchEmployer('Example Technologies Pvt. Ltd.', employers)?.id).toBe('e1');
    expect(matchEmployer('example technologies', employers)?.id).toBe('e1');
    expect(matchEmployer('Sample', employers)?.id).toBe('e2');
    expect(matchEmployer('Other Works Ltd', employers)).toBeNull();
  });
});

describe('classifyLabel', () => {
  it.each([
    ['Provident Fund', 'deductions', 'epfEmployee'],
    ['EPF', null, 'epfEmployee'],
    ['PF - Employee', 'deductions', 'epfEmployee'],
    ['VPF', null, 'vpf'],
    ['Voluntary PF', 'deductions', 'vpf'],
    ['Income Tax', 'deductions', 'tds'],
    ['TDS', null, 'tds'],
    ['Professional Tax', 'deductions', 'deduction'],
    ['PT', null, 'deduction'],
    ['Employer PF', null, 'employerEpf'],
    ['PF Employer Contribution', null, 'employerEpf'],
    ['EPS', null, 'employerEps'],
    ['Employee Pension Scheme', 'employer', 'employerEps'],
    ['Employer ESI', null, 'employerOther'],
    ['NPS', 'deductions', 'deduction'],
    ['Gross Earnings', null, 'gross'],
    ['Total', 'earnings', 'gross'],
    ['Total', 'deductions', 'totalDeductions'],
    ['Net Pay', null, 'net'],
    ['Take Home', null, 'net'],
    ['Amount credited', null, 'net'],
    ['Leave Encashment', 'earnings', 'earning'],
    ['Days Paid', 'earnings', 'info'],
    ['Taxable Income', null, 'info'],
    ['Medical Insurance', 'deductions', 'deduction'],
  ] as const)('%s (under %s) → %s', (label, section, kind) => {
    expect(classifyLabel(label, section).kind).toBe(kind);
  });

  it('places a line by its words only when the layout does not, and says so', () => {
    expect(classifyLabel('Basic', null)).toEqual({ kind: 'earning', guessed: true });
    expect(classifyLabel('Loan recovery', null)).toEqual({ kind: 'deduction', guessed: true });
    expect(classifyLabel('Something', null).kind).toBe('unknown');
  });

  it.each([
    'UAN',
    'PAN',
    'Aadhaar No',
    'PF No.',
    'PF A/c Number',
    'ESIC No',
    'Bank A/c No',
    'Account Number',
    'IFSC',
    'Employee ID',
    'Emp Code',
    'Date of Birth',
    'Address',
  ])('%s is an identity label', (label) => {
    expect(isIdentityLabel(label)).toBe(true);
    expect(classifyLabel(label, 'deductions').kind).toBe('identity');
  });

  it('keeps pay lines that only look similar', () => {
    expect(isIdentityLabel('ESI')).toBe(false);
    expect(isIdentityLabel('PF')).toBe(false);
    expect(isIdentityLabel('Special Allowance')).toBe(false);
  });
});
