import { fireEvent, screen } from '@testing-library/react-native';
import { pickFiles } from '@/features/investments/import/pickFiles';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { monthLabel } from '@/lib/domain/expenses';
import { line } from '@/lib/domain/salary/payslipImport/__fixtures__/textLines';
import { extractPdfText, PasswordNeeded } from '@/lib/files/pdfText';
import { renderWithProviders } from '@/test/render';
import { useSalaryStore } from '../../state/salaryStore';
import { PayslipImportFlow } from '../PayslipImportFlow';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: () => null }));
jest.mock('@/features/investments/import/pickFiles', () => ({
  canPickFiles: true,
  pickFiles: jest.fn(),
}));
jest.mock('@/lib/files/pdfText', () => ({
  ...jest.requireActual('@/lib/files/pdfText'),
  extractPdfText: jest.fn(),
}));

const pdf = { name: 'payslip.pdf', bytes: new TextEncoder().encode('%PDF-1.4 sample') };

/** A payslip page as the extractor gives it. */
function page(employer: string, month: string, employerPf = true) {
  return [
    line([[40, employer]], 800, 16),
    line([[40, `Payslip for the month of ${monthLabel(month)}`]], 780),
    line([[40, 'UAN: 000000000000']], 770),
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
        [180, '45,000.00'],
        [300, 'Provident Fund'],
        [460, '5,400.00'],
      ],
      685,
    ),
    line(
      [
        [40, 'HRA'],
        [180, '18,000.00'],
        [300, 'Income Tax'],
        [460, '6,000.00'],
      ],
      670,
    ),
    line(
      [
        [300, 'Professional Tax'],
        [460, '200.00'],
      ],
      655,
    ),
    line(
      [
        [40, 'Gross Earnings'],
        [180, '63,000.00'],
        [300, 'Total Deductions'],
        [460, '11,600.00'],
      ],
      640,
    ),
    line([[40, 'Net Pay: 51,400.00']], 620),
    ...(employerPf ? [line([[40, 'Employer PF: 4,150.00 EPS: 1,250.00']], 600)] : []),
  ];
}
const result = (lines: ReturnType<typeof page>) => ({ pages: [lines], images: 0, unreadable: 0 });

beforeEach(() => {
  jest.clearAllMocks();
  useSalaryStore.getState().resetPreview();
  useExpenseStore.getState().resetPreview();
  jest.mocked(pickFiles).mockResolvedValue([pdf]);
});

async function choose() {
  await renderWithProviders(<PayslipImportFlow onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Choose files' }));
}

describe('payslip import', () => {
  it('asks for the password, adds the new employer and saves with Save all', async () => {
    jest
      .mocked(extractPdfText)
      .mockRejectedValueOnce(new PasswordNeeded(false))
      .mockRejectedValueOnce(new PasswordNeeded(true))
      .mockResolvedValueOnce(result(page('Example Works Pvt Ltd', '2026-04')));
    await choose();
    expect(await screen.findByText(/This PDF is password-protected/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('PDF password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('That password did not open it. Try again.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('PDF password'), 'sample-pass');
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    expect(jest.mocked(extractPdfText).mock.calls[2][1]).toMatchObject({ password: 'sample-pass' });

    expect(await screen.findByText('April 2026')).toBeTruthy();
    expect(screen.getByText('New employer: Example Works Pvt Ltd')).toBeTruthy();
    expect(screen.getByText('Gross ₹63,000.00 · Net ₹51,400.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save all (0)' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Add employer' }));
    expect(screen.getByText('Totals match')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save all (1)' }));

    const { employers, payslips, pfEntries } = useSalaryStore.getState();
    const employer = employers.find((item) => item.name === 'Example Works Pvt Ltd')!;
    const saved = payslips.find((slip) => slip.employerId === employer.id)!;
    expect(saved).toMatchObject({
      month: '2026-04',
      earnings: [
        { label: 'Basic', amount: 45_000_00 },
        { label: 'HRA', amount: 18_000_00 },
      ],
      deductions: [{ label: 'Professional Tax', amount: 200_00 }],
      epfEmployee: 5_400_00,
      tds: 6_000_00,
      employerEpf: 4_150_00,
      employerEps: 1_250_00,
    });
    expect(pfEntries.find((entry) => entry.payslipId === saved.id)).toMatchObject({
      date: '2026-04-01',
      employee: 5_400_00,
      employer: 4_150_00,
      pension: 1_250_00,
    });
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(JSON.stringify(useSalaryStore.getState())).not.toMatch(/000000000000|sample-pass/);
  });

  it('opens the payslip form filled in, estimates the employer share on request', async () => {
    const month = useSalaryStore.getState().payslips[0].month.replace(/^\d{4}/, '2025');
    jest
      .mocked(extractPdfText)
      .mockResolvedValue(result(page('Sample Labs Private Limited', month, false)));
    await choose();
    expect(await screen.findByText('Sample Labs Pvt Ltd')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Review and save' }));
    expect(screen.getByLabelText('Employee PF (EPF)').props.value).toBe('5400');
    expect(screen.getByLabelText('Employer PF (EPF)').props.value).toBe('');
    await fireEvent.press(screen.getByRole('button', { name: 'Estimate employer share' }));
    expect(screen.getByText(/Check them in your EPFO passbook/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add payslip' }));
    const saved = useSalaryStore.getState().payslips.find((slip) => slip.month === month)!;
    expect(saved).toMatchObject({ employerEpf: 4_150_00, employerEps: 1_250_00 });
    expect(saved.note).toMatch(/estimated/);
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('says “Already added” and replaces the payslip through the edit path', async () => {
    const before = useSalaryStore.getState().payslips;
    const existing = before[0];
    jest
      .mocked(extractPdfText)
      .mockResolvedValue(result(page('SAMPLE LABS PVT. LTD.', existing.month)));
    await choose();
    expect(await screen.findByText('Already added')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Replace' }));
    expect(screen.getByText('Edit payslip')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    const after = useSalaryStore.getState().payslips;
    expect(after).toHaveLength(before.length);
    expect(after.find((slip) => slip.id === existing.id)).toMatchObject({ tds: 6_000_00 });
  });

  it('explains scanned payslips and lets the owner skip a protected file', async () => {
    jest
      .mocked(extractPdfText)
      .mockResolvedValueOnce({ pages: [[]], images: 1, unreadable: 0 })
      .mockRejectedValueOnce(new PasswordNeeded(false));
    jest.mocked(pickFiles).mockResolvedValue([pdf, { ...pdf, name: 'locked.pdf' }]);
    await choose();
    expect(
      await screen.findByText('This payslip is a scanned image; enter it by hand (Add payslip).'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip this file' }));
    expect(screen.queryByLabelText('PDF password')).toBeNull();
  });
});
