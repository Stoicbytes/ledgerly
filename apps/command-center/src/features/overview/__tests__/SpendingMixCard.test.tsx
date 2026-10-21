import { screen } from '@testing-library/react-native';
import type { SpendingRow } from '@/lib/domain/insights';
import { renderWithProviders } from '@/test/render';
import { SpendingMixCard } from '../SpendingMixCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: () => null }));

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

  it('says when nothing is spent yet', async () => {
    await renderWithProviders(
      <SpendingMixCard spending={{ rows: [], total: 0, previousTotal: 0 }} comparison="vs Sept" />,
    );
    expect(screen.getByText('Nothing spent yet this month')).toBeTruthy();
  });
});
