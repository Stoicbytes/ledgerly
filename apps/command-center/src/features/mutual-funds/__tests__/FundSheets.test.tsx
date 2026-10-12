import { fireEvent, screen } from '@testing-library/react-native';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { renderWithProviders } from '@/test/render';
import { FundEditSheet } from '../FundEditSheet';
import { FundTxnSheet } from '../FundTxnSheet';
import { MutualFundsScreen } from '../MutualFundsScreen';

beforeEach(() => usePortfolioStore.getState().resetPreview());

const handFund = () =>
  usePortfolioStore.getState().saveFund({
    schemeCode: null,
    name: 'My Debt Fund',
    category: 'Debt Scheme',
    fundHouse: '',
    folio: '',
    manualNav: null,
    manualNavDate: null,
    note: '',
  });

describe('FundEditSheet', () => {
  it('adds a fund by hand with a manual NAV', async () => {
    const onSaved = jest.fn();
    await renderWithProviders(
      <FundEditSheet fundId={null} onClose={jest.fn()} onSaved={onSaved} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Fund name'), 'Local Gilt Fund');
    await fireEvent.press(screen.getByRole('button', { name: 'Debt' }));
    await fireEvent.changeText(screen.getByLabelText('NAV entered by hand'), '12.3456');
    await fireEvent.press(screen.getByRole('button', { name: 'Add fund' }));
    const fund = usePortfolioStore.getState().funds.find((item) => item.name === 'Local Gilt Fund');
    expect(fund).toMatchObject({ category: 'Debt Scheme', manualNav: 12.3456, schemeCode: null });
    expect(onSaved).toHaveBeenCalledWith(fund?.id);
  });

  it('asks for a name', async () => {
    await renderWithProviders(
      <FundEditSheet fundId={null} onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Add fund' }));
    expect(screen.getByText('Enter the fund name.')).toBeTruthy();
  });
});

describe('FundTxnSheet', () => {
  it('records a purchase with stamp duty and works out the units', async () => {
    const fund = handFund();
    const onClose = jest.fn();
    await renderWithProviders(<FundTxnSheet fundId={fund.id} txnId={null} onClose={onClose} />);
    await fireEvent.changeText(screen.getByLabelText('Amount paid'), '5000');
    await fireEvent.changeText(screen.getByLabelText('NAV (₹ per unit)'), '58.12');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    const [txn] = usePortfolioStore.getState().fundTxns.filter((item) => item.fundId === fund.id);
    expect(txn).toMatchObject({
      kind: 'buy',
      amount: 500000,
      stampDuty: 25,
      units: 86.025,
      nav: 58.12,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('refuses to redeem more units than are held', async () => {
    const fund = handFund();
    await renderWithProviders(<FundTxnSheet fundId={fund.id} txnId={null} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Redemption' }));
    await fireEvent.changeText(screen.getByLabelText('Amount received'), '100');
    await fireEvent.changeText(screen.getByLabelText('NAV (₹ per unit)'), '10');
    await fireEvent.changeText(screen.getByLabelText('Units'), '10');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Only 0.000 units were held on that date.')).toBeTruthy();
    expect(usePortfolioStore.getState().fundTxns.some((item) => item.fundId === fund.id)).toBe(
      false,
    );
  });
});

describe('MutualFundsScreen', () => {
  it('invites adding the first fund when there are none', async () => {
    usePortfolioStore
      .getState()
      .restorePortfolio({ funds: [], fundTxns: [], sips: [], stocks: [], trades: [] });
    await renderWithProviders(<MutualFundsScreen />);
    expect(screen.getByText('Track your mutual funds')).toBeTruthy();
  });

  it('shows the sample holdings in the preview', async () => {
    await renderWithProviders(<MutualFundsScreen />);
    expect(screen.getByText('Holdings')).toBeTruthy();
    expect(screen.getAllByText(/Horizon Bluechip Fund/).length).toBeGreaterThan(0);
  });
});
