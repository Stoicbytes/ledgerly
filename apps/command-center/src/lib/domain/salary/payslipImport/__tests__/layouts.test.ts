import { detectPayslip, detectPayslips } from '..';
import { line } from '../__fixtures__/textLines';

const header = [
  line([[40, 'Example Works Pvt Ltd']], 800, 16),
  line([[40, 'Payslip for the month of September 2026']], 780),
];

describe('layouts', () => {
  it('takes the Current Month column, not YTD, wherever the columns sit', () => {
    const slip = detectPayslip([
      ...header,
      line(
        [
          [40, 'Earnings'],
          [300, 'YTD'],
          [400, 'Current Month'],
        ],
        700,
      ),
      line(
        [
          [40, 'Basic'],
          [300, '2,40,000.00'],
          [400, '40,000.00'],
        ],
        685,
      ),
      line(
        [
          [40, 'Deductions'],
          [300, 'YTD'],
          [400, 'Current Month'],
        ],
        670,
      ),
      line(
        [
          [40, 'Income Tax'],
          [300, '30,000.00'],
          [400, '5,000.00'],
        ],
        655,
      ),
    ]);
    expect(slip.earnings).toEqual([{ label: 'Basic', amount: 40_000_00 }]);
    expect(slip.tds).toBe(5_000_00);
  });

  it('leaves a line out when only its YTD figure is printed', () => {
    const slip = detectPayslip([
      ...header,
      line(
        [
          [40, 'Earnings'],
          [300, 'Current'],
          [400, 'YTD'],
        ],
        700,
      ),
      line(
        [
          [40, 'Basic'],
          [300, '40,000'],
        ],
        685,
      ),
      line(
        [
          [40, 'Bonus'],
          [400, '10,000'],
        ],
        670,
      ),
    ]);
    expect(slip.earnings).toEqual([{ label: 'Basic', amount: 40_000_00 }]);
  });

  it('splits a two-column table into earnings and deductions sides', () => {
    const slip = detectPayslip([
      ...header,
      line(
        [
          [40, 'Earnings'],
          [180, 'Amount'],
          [300, 'Deductions'],
          [460, 'Amount'],
        ],
        700,
      ),
      line(
        [
          [40, 'Basic'],
          [180, '30,000'],
          [300, 'Other'],
          [460, '500'],
        ],
        685,
      ),
      line(
        [
          [40, 'Other'],
          [180, '2,000'],
          [300, 'Canteen'],
          [460, '300'],
        ],
        670,
      ),
    ]);
    expect(slip.earnings).toEqual([
      { label: 'Basic', amount: 30_000_00 },
      { label: 'Other', amount: 2_000_00 },
    ]);
    expect(slip.deductions).toEqual([
      { label: 'Other', amount: 500_00 },
      { label: 'Canteen', amount: 300_00 },
    ]);
    expect(slip.unsure).toEqual([]);
  });

  it('drops identity lines and labels carrying long numbers, and skips the tax working', () => {
    const slip = detectPayslip([
      ...header,
      line(
        [
          [40, 'UAN: 000000000000'],
          [300, 'Bank A/c No: 000000001234'],
        ],
        760,
      ),
      line([[40, 'Earnings']], 700),
      line([[40, 'Basic: 30,000']], 685),
      line([[40, 'Deductions']], 670),
      line([[40, 'Loan 0000012345: 1,000']], 655),
      line([[40, 'Income Tax Computation']], 640),
      line([[40, 'Standard Deduction: 75,000']], 625),
      line([[40, 'Gross Salary: 3,60,000']], 610),
    ]);
    expect(slip.earnings).toEqual([{ label: 'Basic', amount: 30_000_00 }]);
    expect(slip.deductions).toEqual([]);
    expect(slip.printed.gross).toBeNull();
    expect(JSON.stringify(slip)).not.toMatch(/000000000000|000000001234|12345|UAN|A\/c/);
  });

  it('marks guessed sides and an unsure month or employer for checking', () => {
    const slip = detectPayslip([
      line([[40, 'Sample Works']], 800, 14),
      line([[40, 'Sep 2026']], 780),
      line([[40, 'Basic 30,000']], 700),
    ]);
    expect(slip.month).toBe('2026-09');
    expect(slip.unsure.sort()).toEqual(['earnings', 'employer', 'month']);
  });

  it('reads one payslip per page when a file holds several months', () => {
    const page = (month: string, index: number) =>
      [
        line([[40, 'Example Works Pvt Ltd']], 800),
        line([[40, `Payslip for ${month}`]], 780),
        line([[40, 'Basic: 30,000']], 700),
      ].map((item) => ({ ...item, page: index }));
    expect(
      detectPayslips([page('July 2026', 0), page('August 2026', 1)]).map((s) => s.month),
    ).toEqual(['2026-07', '2026-08']);
    expect(detectPayslips([page('July 2026', 0), page('July 2026', 1)])).toHaveLength(1);
  });
});
