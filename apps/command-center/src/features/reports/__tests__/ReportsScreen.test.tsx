import { fireEvent, screen } from '@testing-library/react-native';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import { renderWithProviders } from '@/test/render';
import { ReportsScreen } from '../ReportsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: () => null }));

beforeEach(() => {
  useSalaryStore.getState().resetPreview();
  useExpenseStore.getState().resetPreview();
});

describe('ReportsScreen', () => {
  it('shows this month and steps between periods', async () => {
    await renderWithProviders(<ReportsScreen />);
    expect(screen.getByText('Savings rate')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Later period' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Earlier period' }));
    expect(screen.getByRole('button', { name: 'Later period' })).toBeEnabled();
  });

  it('switches to the financial year, month by month', async () => {
    await renderWithProviders(<ReportsScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Financial year' }));
    expect(screen.getByText(/^FY \d{4}-\d{2}$/)).toBeTruthy();
    expect(screen.getByText('Month by month')).toBeTruthy();
  });
});
