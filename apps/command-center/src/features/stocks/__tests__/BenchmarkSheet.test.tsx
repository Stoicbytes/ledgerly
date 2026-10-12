import { screen } from '@testing-library/react-native';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { loadBenchmark } from '@/lib/data/benchmarkRepository';
import { RpcError } from '@/lib/data/rpc';
import { addDays, todayIso } from '@/lib/domain/expenses';
import type { Series } from '@/lib/domain/investments';
import { renderWithProviders } from '@/test/render';
import { BenchmarkSheet } from '../benchmark/BenchmarkSheet';

jest.mock('@/lib/data/benchmarkRepository', () => ({
  ...jest.requireActual('@/lib/data/benchmarkRepository'),
  loadBenchmark: jest.fn(),
  setBenchmark: jest.fn(),
}));

const load = loadBenchmark as jest.Mock;
const FUND = 'Sample Nifty 50 Index Fund - Direct Plan - Growth';

/** A NAV every day from before the first trade to today. */
function dailyNavs(): Series {
  const first = usePortfolioStore
    .getState()
    .trades.reduce((min, trade) => (trade.date < min ? trade.date : min), todayIso());
  const points: Series = [];
  for (let date = addDays(first, -5); date <= todayIso(); date = addDays(date, 1)) {
    points.push([date, 100]);
  }
  return points;
}

beforeEach(() => {
  usePortfolioStore.getState().resetPreview();
  load.mockReset();
});
afterEach(() => useMarketStore.getState().enterPreview());

describe('BenchmarkSheet', () => {
  it('explains that it needs sign-in in the preview', async () => {
    await renderWithProviders(<BenchmarkSheet onClose={jest.fn()} />);
    expect(screen.getByText(/works when you are signed in/)).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it('compares the shares with the chosen fund', async () => {
    useMarketStore.setState({ mode: 'cloud' });
    load.mockResolvedValue({ schemeCode: 1, name: FUND, category: '', history: dailyNavs() });
    await renderWithProviders(<BenchmarkSheet onClose={jest.fn()} />);
    expect(await screen.findByText('Same money in the index fund')).toBeTruthy();
    expect(
      screen.getByText(/Your shares are .* (ahead of|behind) the index|level with/),
    ).toBeTruthy();
    expect(screen.getByText(new RegExp(`Index fund: ${FUND}`))).toBeTruthy();
  });

  it('asks to fetch the NAV history when none is stored', async () => {
    useMarketStore.setState({ mode: 'cloud' });
    load.mockResolvedValue({ schemeCode: 1, name: FUND, category: '', history: [] });
    await renderWithProviders(<BenchmarkSheet onClose={jest.fn()} />);
    expect(await screen.findByText(/NAV history is not stored yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update prices' })).toBeTruthy();
  });

  it('names the database update when it is missing', async () => {
    useMarketStore.setState({ mode: 'cloud' });
    load.mockRejectedValue(new RpcError(404, 'PGRST202'));
    await renderWithProviders(<BenchmarkSheet onClose={jest.fn()} />);
    expect(await screen.findByText(/202610150014_stock_benchmark.sql/)).toBeTruthy();
  });
});
