import { fireEvent, screen } from '@testing-library/react-native';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { renderWithProviders } from '@/test/render';
import { StockEditSheet } from '../StockEditSheet';
import { StocksScreen } from '../StocksScreen';
import { TradeSheet } from '../TradeSheet';

beforeEach(() => usePortfolioStore.getState().resetPreview());

describe('StockEditSheet', () => {
  it('adds a stock by hand and refuses a duplicate symbol', async () => {
    const onSaved = jest.fn();
    await renderWithProviders(
      <StockEditSheet stockId={null} onClose={jest.fn()} onSaved={onSaved} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Symbol'), 'infy');
    await fireEvent.changeText(screen.getByLabelText('Company name'), 'Infosys');
    await fireEvent.press(screen.getByRole('button', { name: 'Technology' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add stock' }));
    const stock = usePortfolioStore.getState().stocks.find((item) => item.symbol === 'INFY');
    expect(stock).toMatchObject({ name: 'Infosys', sector: 'Technology', exchange: 'NSE' });
    expect(onSaved).toHaveBeenCalledWith(stock?.id);
  });

  it('refuses a symbol already in the list', async () => {
    await renderWithProviders(
      <StockEditSheet stockId={null} onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Symbol'), 'AURA');
    await fireEvent.changeText(screen.getByLabelText('Company name'), 'Again');
    await fireEvent.press(screen.getByRole('button', { name: 'Add stock' }));
    expect(screen.getByText('This stock is already in your list.')).toBeTruthy();
  });
});

describe('TradeSheet', () => {
  it('records a sale within the holding and refuses a larger one', async () => {
    const aura = usePortfolioStore.getState().stocks.find((item) => item.symbol === 'AURA')!;
    const onClose = jest.fn();
    await renderWithProviders(<TradeSheet stockId={aura.id} tradeId={null} onClose={onClose} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Sell' }));
    await fireEvent.changeText(screen.getByLabelText('Shares'), '41');
    await fireEvent.changeText(screen.getByLabelText('Price per share'), '1700');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Only 40 shares were held on that date.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Shares'), '40');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(onClose).toHaveBeenCalled();
    expect(
      usePortfolioStore
        .getState()
        .trades.filter((item) => item.stockId === aura.id && item.kind === 'sell'),
    ).toHaveLength(1);
  });
});

describe('StocksScreen', () => {
  it('invites adding the first stock when there are none', async () => {
    usePortfolioStore
      .getState()
      .restorePortfolio({ funds: [], fundTxns: [], sips: [], stocks: [], trades: [] });
    await renderWithProviders(<StocksScreen />);
    expect(screen.getByText('Track your shares')).toBeTruthy();
  });
});
