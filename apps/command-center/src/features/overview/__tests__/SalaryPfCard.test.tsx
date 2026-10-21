import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import { renderWithProviders } from '@/test/render';
import { SalaryPfCard } from '../SalaryPfCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: () => null }));
// Charts draw in with requestAnimationFrame; show them drawn.
jest.mock('@/hooks/useTween', () => ({ useTween: () => 1, useCountUp: (value: number) => value }));

beforeEach(() => useSalaryStore.getState().resetPreview());

describe('SalaryPfCard', () => {
  it('shows the newest net pay, the year’s tax, the PF balance and both charts', async () => {
    await renderWithProviders(<SalaryPfCard />);
    expect(screen.getByText('Latest net pay')).toBeTruthy();
    // Sample pay: 75,000 − 200 PT − 5,400 EPF − 6,500 TDS
    expect(screen.getByText('₹62,900')).toBeTruthy();
    expect(screen.getByText('Tax deducted (TDS)')).toBeTruthy();
    expect(screen.getByText('PF balance')).toBeTruthy();
    expect(screen.getByText('Pension (EPS)')).toBeTruthy();
    expect(screen.getByLabelText(/^Net pay, last 12 months, from ₹/)).toBeTruthy();
    expect(screen.getByLabelText(/^PF balance, last 24 months, from ₹/)).toBeTruthy();
  });

  it('offers to import payslips when there is nothing yet', async () => {
    useSalaryStore.setState({ payslips: [], pfEntries: [] });
    await renderWithProviders(<SalaryPfCard />);
    expect(screen.getByText(/Import your payslips to see net pay by month/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Import payslips' }));
    expect(router.push).toHaveBeenCalledWith('/dashboard/salary');
  });

  it('shows only the PF part when there are PF entries but no payslips', async () => {
    useSalaryStore.setState({ payslips: [] });
    await renderWithProviders(<SalaryPfCard />);
    expect(screen.queryByText('Latest net pay')).toBeNull();
    expect(screen.getByText('PF balance')).toBeTruthy();
    expect(screen.queryByLabelText(/^Net pay/)).toBeNull();
  });

  it('is hidden while Salary & PF needs a database update', async () => {
    useSalaryStore.setState({ available: false });
    await renderWithProviders(<SalaryPfCard />);
    expect(screen.queryByText('Salary & PF')).toBeNull();
  });
});
