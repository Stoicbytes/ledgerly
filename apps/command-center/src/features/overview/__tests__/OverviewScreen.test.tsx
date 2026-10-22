import { screen } from '@testing-library/react-native';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import { renderWithProviders } from '@/test/render';
import { OverviewScreen } from '../OverviewScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: () => null }));
jest.mock('@/hooks/useTween', () => ({ useTween: () => 1, useCountUp: (value: number) => value }));

beforeEach(() => {
  useExpenseStore.getState().resetPreview();
  useSalaryStore.getState().resetPreview();
});

describe('OverviewScreen', () => {
  it('shows the sample net worth trend, insights, Salary & PF and spending by category', async () => {
    await renderWithProviders(<OverviewScreen />);
    expect(screen.getByLabelText(/^Net worth, last \d+ months: /)).toBeTruthy();
    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getByText('NEEDS A LOOK')).toBeTruthy();
    expect(await screen.findByText('Latest net pay')).toBeTruthy();
    expect(await screen.findByText('Spending by category')).toBeTruthy();
  });

  it('shows the Salary & PF prompt for a new user without payslips', async () => {
    useSalaryStore.setState({ payslips: [], pfEntries: [] });
    await renderWithProviders(<OverviewScreen />);
    expect(await screen.findByRole('button', { name: 'Import payslips' })).toBeTruthy();
  });
});
