import { readFileSync } from 'fs';
import { join } from 'path';
import { useSalaryStore } from '../../state/salaryStore';
import { readDraft } from '../../payslipDraft';
import { draftFromImport, importStatus } from '../importDraft';
import { readPayslipFile, SCANNED } from '../readPayslipFile';

const FIXTURES = join(__dirname, '../../../../lib/domain/salary/payslipImport/__fixtures__');
const file = (name: string) => ({
  name,
  bytes: new Uint8Array(readFileSync(join(FIXTURES, name))),
});

beforeEach(() => useSalaryStore.getState().resetPreview());

describe('payslip file → draft → payslip to save', () => {
  it('reads a protected PDF with its password into the payslip form', async () => {
    expect(await readPayslipFile(file('payslip-aes128.pdf'))).toEqual({
      kind: 'password',
      wrong: false,
    });
    const read = await readPayslipFile(file('payslip-aes128.pdf'), 'sample-pass');
    if (read.kind !== 'read') throw new Error(read.kind);
    const [slip] = read.slips;
    const { employers, payslips } = useSalaryStore.getState();
    const status = importStatus(slip, employers, payslips);
    expect(status).toMatchObject({ employer: null, existing: null, warnings: [] });
    const draft = draftFromImport(slip, 'emp-new');
    expect(draft).toMatchObject({ month: '2026-08', paidOn: '2026-08-31', epfEmployee: '14815' });
    const result = readDraft(draft, payslips, null);
    expect(result.input).toMatchObject({
      employerId: 'emp-new',
      month: '2026-08',
      earnings: [
        { label: 'Basic Salary', amount: 1_23_456_00 },
        { label: 'House Rent Allowance', amount: 49_382_00 },
        { label: 'Leave Travel Allowance', amount: 5_000_00 },
      ],
      epfEmployee: 14_815_00,
      vpf: 2_000_00,
      tds: 31_250_00,
      employerEpf: 0,
      employerEps: 0,
    });
  });

  it('turns away scans, photos and other files with a clear reason', async () => {
    expect(await readPayslipFile(file('payslip-scanned.pdf'))).toEqual({
      kind: 'problem',
      message: SCANNED,
    });
    const photo = { name: 'payslip.jpg', bytes: Uint8Array.from([0xff, 0xd8, 0xff]) };
    expect(await readPayslipFile(photo)).toEqual({ kind: 'problem', message: SCANNED });
    const other = { name: 'notes.txt', bytes: new TextEncoder().encode('hello') };
    expect(await readPayslipFile(other)).toMatchObject({ kind: 'problem' });
  });

  it('reads a CSV payroll export, one payslip per month', async () => {
    const csv =
      'Month,Company,Basic,PF,Net Pay\nJul-2026,Sample Labs,30000,3600,26400\nAug-2026,Sample Labs,30000,3600,26400\n';
    const read = await readPayslipFile({
      name: 'payroll.csv',
      bytes: new TextEncoder().encode(csv),
    });
    expect(read.kind === 'read' && read.slips.map((slip) => slip.month)).toEqual([
      '2026-07',
      '2026-08',
    ]);
  });
});
