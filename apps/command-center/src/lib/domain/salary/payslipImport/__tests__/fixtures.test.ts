import { readFileSync } from 'fs';
import { join } from 'path';
import { constants, inflateSync } from 'zlib';
import { extractPdfText } from '@/lib/files/pdfText';
import { checkTotals, detectPayslips } from '..';

const inflate = async (data: Uint8Array) =>
  new Uint8Array(inflateSync(data, { finishFlush: constants.Z_SYNC_FLUSH }));
async function read(name: string, password?: string) {
  const bytes = new Uint8Array(readFileSync(join(__dirname, '../__fixtures__', name)));
  const { pages } = await extractPdfText(bytes, {
    inflate,
    subtle: globalThis.crypto.subtle,
    password,
  });
  const slips = detectPayslips(pages);
  expect(slips).toHaveLength(1);
  return slips[0];
}

describe('payslip PDFs → what they say', () => {
  it('(a) a two-column Earnings | Deductions table', async () => {
    const slip = await read('payslip-two-column.pdf');
    expect(slip).toMatchObject({
      month: '2026-09',
      paidOn: '2026-09-30',
      employerName: 'Example Technologies Pvt Ltd',
      earnings: [
        { label: 'Basic', amount: 50_000_00 },
        { label: 'HRA', amount: 20_000_00 },
        { label: 'Special Allowance', amount: 15_250_50 },
        { label: 'Conveyance', amount: 1_600_00 },
      ],
      deductions: [{ label: 'Professional Tax', amount: 200_00 }],
      epfEmployee: 1_800_00,
      vpf: 0,
      tds: 7_450_00,
      employerEpf: null,
      employerEps: null,
      printed: { gross: 86_850_50, deductions: 9_450_00, net: 77_400_50 },
      unsure: [],
    });
    expect(checkTotals(slip)).toEqual([]);
  });

  it('(b) a label: value list with ₹ and lakh grouping', async () => {
    const slip = await read('payslip-label-value.pdf');
    expect(slip).toMatchObject({
      month: '2026-08',
      paidOn: '2026-08-31',
      employerName: 'Sample Software Solutions LLP',
      earnings: [
        { label: 'Basic Salary', amount: 1_23_456_00 },
        { label: 'House Rent Allowance', amount: 49_382_00 },
        { label: 'Leave Travel Allowance', amount: 5_000_00 },
      ],
      deductions: [
        { label: 'Prof. Tax', amount: 200_00 },
        { label: 'Group Medical Insurance', amount: 1_250_00 },
      ],
      epfEmployee: 14_815_00,
      vpf: 2_000_00,
      tds: 31_250_00,
      printed: { gross: 1_77_838_00, deductions: 49_515_00, net: 1_28_323_00 },
    });
    expect(checkTotals(slip)).toEqual([]);
  });

  it('(c) Current Month and YTD columns: only this month counts', async () => {
    const slip = await read('payslip-ytd.pdf');
    expect(slip).toMatchObject({
      month: '2026-07',
      paidOn: null,
      employerName: 'Example Analytics Private Limited',
      earnings: [
        { label: 'Basic', amount: 40_000_00 },
        { label: 'HRA', amount: 16_000_00 },
        { label: 'Other Allowance', amount: 9_000_00 },
        { label: 'Performance Bonus', amount: 5_000_00 },
      ],
      deductions: [
        { label: 'Professional Tax', amount: 200_00 },
        { label: 'Meal Coupons', amount: 1_100_00 },
      ],
      epfEmployee: 4_800_00,
      tds: 5_600_00,
      printed: { gross: 70_000_00, deductions: 11_700_00, net: 58_300_00 },
    });
    expect(checkTotals(slip)).toEqual([]);
  });

  it('(d) Full | Actual columns with the employer PF and EPS printed', async () => {
    const slip = await read('payslip-employer-pf.pdf');
    expect(slip).toMatchObject({
      month: '2026-10',
      employerName: 'Sample Retail Services Ltd.',
      earnings: [
        { label: 'Basic', amount: 15_000_00 },
        { label: 'Dearness Allowance', amount: 5_000_00 },
        { label: 'Overtime', amount: 1_200_00 },
        { label: 'Arrears', amount: 500_00 },
      ],
      deductions: [
        { label: 'ESI', amount: 195_00 },
        { label: 'Salary Advance', amount: 2_000_00 },
      ],
      epfEmployee: 1_800_00,
      employerEpf: 550_00,
      employerEps: 1_250_00,
      printed: { gross: 21_700_00, deductions: 3_995_00, net: 17_705_00 },
    });
    expect(checkTotals(slip)).toEqual([]);
  });

  it('(e) a password-protected copy reads the same once opened', async () => {
    const plain = await read('payslip-two-column.pdf');
    expect(await read('payslip-aes256.pdf', 'sample-pass')).toEqual(plain);
  });

  it('never keeps identity numbers or personal details', async () => {
    for (const name of ['payslip-two-column.pdf', 'payslip-ytd.pdf', 'payslip-employer-pf.pdf']) {
      const json = JSON.stringify(await read(name));
      expect(json).not.toMatch(
        /UAN|PAN|A\/c|EMP-0001|Sample Employee|000000000000|000000001234|XXXXX|Joining|Bengaluru/,
      );
    }
  });
});
