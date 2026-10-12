import { act, fireEvent, screen } from '@testing-library/react-native';
import { saveCsv } from '@/features/expenses/export/saveCsv';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { buy, fund, sell } from '@/lib/domain/investments/__fixtures__';
import { EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { renderWithProviders } from '@/test/render';
import { CapitalGainsPanel } from '../CapitalGainsPanel';

jest.mock('@/features/expenses/export/saveCsv', () => ({
  saveCsv: jest.fn(async () => undefined),
}));

beforeEach(() => {
  usePortfolioStore.setState({
    ...EMPTY_PORTFOLIO,
    funds: [fund()],
    fundTxns: [
      buy('2024-01-05', 100_000, 100, 10),
      sell('2025-08-01', 150_000, 100, 15),
      buy('2026-01-05', 100_000, 100, 10),
      sell('2026-05-01', 120_000, 100, 12),
    ],
  });
});

describe('CapitalGainsPanel', () => {
  it('shows the newest year by type, switches years and exports one', async () => {
    await renderWithProviders(<CapitalGainsPanel />);
    expect(screen.getByText('Equity · short term')).toBeTruthy();
    expect(screen.queryByText(/are exempt/)).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'FY 2025-26' }));
    expect(screen.getByText('Equity · long term')).toBeTruthy();
    expect(screen.getByText(/₹1,25,000 a year are exempt/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Export FY 2025-26' }));
    });
    const [csv, name] = jest.mocked(saveCsv).mock.calls[0];
    expect(name).toBe('capital-gains-2025-26.csv');
    expect(csv).toContain(
      '2024-01-05,2025-08-01,574,100.0000,1000.00,1500.00,500.00,Equity · long term',
    );
  });

  it('says when there is nothing sold', async () => {
    usePortfolioStore.setState({ ...EMPTY_PORTFOLIO, funds: [fund()], fundTxns: [] });
    await renderWithProviders(<CapitalGainsPanel />);
    expect(screen.getByText('No redemptions yet')).toBeTruthy();
  });
});
