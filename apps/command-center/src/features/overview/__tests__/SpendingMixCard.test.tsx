import { fireEvent, screen } from '@testing-library/react-native';
import type { SpendingRow } from '@/lib/domain/insights';
import { renderWithProviders } from '@/test/render';
import { SpendingMixCard } from '../SpendingMixCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: () => null }));
// The pie's draw-in animation is not under test; it would update after the test ends.
jest.mock('@/hooks/useTween', () => ({ useTween: () => 1 }));

const row = (id: string, amount: number, previous: number, share: number): SpendingRow => ({
  id,
  name: id,
  amount,
  previous,
  share,
  count: 1,
  category: null,
});

describe('SpendingMixCard', () => {
  it('lists each category with its share and the change on last month', async () => {
    const spending = {
      rows: [row('Rent', 30_000_00, 30_000_00, 0.6), row('Food', 20_000_00, 15_000_00, 0.4)],
      total: 50_000_00,
      previousTotal: 45_000_00,
    };
    await renderWithProviders(<SpendingMixCard spending={spending} comparison="vs 1–21 Sept" />);
    expect(screen.getByText('₹50,000 this month · up ₹5,000 vs 1–21 Sept')).toBeTruthy();
    expect(
      screen.getByLabelText('Food: ₹20,000, 40% of spending, up ₹5,000 vs 1–21 Sept.'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Rent: ₹30,000, 60% of spending, no change vs 1–21 Sept.'),
    ).toBeTruthy();
  });

  it('opens a category in Stats when pressed', async () => {
    const { router } = jest.requireMock('expo-router');
    const { useExpenseUi } = jest.requireActual('@/features/expenses/state/expenseUi');
    const food = { ...row('Food', 20_000_00, 15_000_00, 1), category: { id: 'Food' } };
    await renderWithProviders(
      <SpendingMixCard
        spending={{ rows: [food as SpendingRow], total: 20_000_00, previousTotal: 0 }}
        comparison="vs Sept"
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: /^Food:/ }));
    expect(useExpenseUi.getState().drillCategoryId).toBe('Food');
    expect(router.push).toHaveBeenCalledWith('/dashboard/expenses/stats');
  });

  it('says when nothing is spent yet', async () => {
    await renderWithProviders(
      <SpendingMixCard spending={{ rows: [], total: 0, previousTotal: 0 }} comparison="vs Sept" />,
    );
    expect(screen.getByText('Nothing spent yet this month')).toBeTruthy();
  });
});
