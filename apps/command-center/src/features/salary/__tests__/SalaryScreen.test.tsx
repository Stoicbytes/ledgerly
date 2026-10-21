import { fireEvent, screen } from '@testing-library/react-native';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { renderWithProviders } from '@/test/render';
import { SalaryScreen } from '../SalaryScreen';
import { useSalaryStore } from '../state/salaryStore';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: () => null }));

beforeEach(() => {
  useSalaryStore.getState().resetPreview();
  useExpenseStore.getState().resetPreview();
});

describe('SalaryScreen', () => {
  it('shows the year, the payslips and the PF passbook', async () => {
    await renderWithProviders(<SalaryScreen />);
    expect(screen.getAllByText('Sample Labs Pvt Ltd').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('radio', { name: 'PF / EPF' }));
    expect(screen.getByText('PF balance')).toBeTruthy();
    expect(screen.getByText('Pension (EPS)')).toBeTruthy();
  });

  it('adds next month’s payslip from the last one and its PF contribution', async () => {
    await renderWithProviders(<SalaryScreen />);
    const before = useSalaryStore.getState();
    await fireEvent.press(screen.getByRole('button', { name: 'Add payslip' }));
    await fireEvent.changeText(screen.getByLabelText('Income tax (TDS)'), '7000');
    const buttons = screen.getAllByRole('button', { name: 'Add payslip' });
    await fireEvent.press(buttons[buttons.length - 1]);
    const after = useSalaryStore.getState();
    expect(after.payslips).toHaveLength(before.payslips.length + 1);
    const added = after.payslips.find(
      (slip) => !before.payslips.some((old) => old.id === slip.id),
    )!;
    expect(added.tds).toBe(7_000_00);
    expect(added.earnings.map((line) => line.label)).toEqual(['Basic', 'HRA', 'Special allowance']);
    expect(after.pfEntries.some((entry) => entry.payslipId === added.id)).toBe(true);
  });

  it('offers Import payslips next to Add payslip on the Payslips tab', async () => {
    await renderWithProviders(<SalaryScreen />);
    expect(screen.getByRole('button', { name: 'Import payslips' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'PF / EPF' }));
    expect(screen.queryByRole('button', { name: 'Import payslips' })).toBeNull();
  });

  it('says the database needs updating when salary tables are missing', async () => {
    useSalaryStore.setState({ available: false });
    await renderWithProviders(<SalaryScreen />);
    expect(screen.getByText('Salary & PF needs a database update')).toBeTruthy();
  });
});
