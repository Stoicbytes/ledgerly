import { fireEvent, screen } from '@testing-library/react-native';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { stock, trade } from '@/lib/domain/investments/__fixtures__';
import { renderWithProviders } from '@/test/render';
import { ImportTradebookSheet } from '../ImportTradebookSheet';
import { pickFiles } from '../pickFiles';

jest.mock('../pickFiles', () => ({ canPickFiles: true, pickFiles: jest.fn() }));

const CSV = [
  'Symbol,ISIN,Trade Date,Exchange,Segment,Series,Trade Type,Auction,Quantity,Price,Trade ID',
  'SAMPLE FLEXI CAP FUND - DIRECT PLAN,INF000S01011,2026-09-01,BSE,MF,,buy,false,12.115,90.7896,m1',
  'SAMPLE FLEXI CAP FUND - DIRECT PLAN,INF000S01011,2026-10-01,NSE,MF,,buy,false,12.463,88.2569,m2',
  'SAMPLEBEES,INF000S01029,2026-08-10,NSE,EQ,EQ,sell,false,4,124.76,e1',
].join('\n');
const file = { name: 'tradebook.csv', bytes: new TextEncoder().encode(CSV) };

beforeEach(() => {
  jest.clearAllMocks();
  usePortfolioStore.setState({ ...EMPTY_PORTFOLIO });
  jest.mocked(pickFiles).mockResolvedValue([file]);
});

describe('ImportTradebookSheet', () => {
  it('shows every trade to add and adds nothing until approved', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<ImportTradebookSheet onClose={onClose} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose files' }));
    expect(await screen.findByText('2 new trades in 1 holding to review.')).toBeTruthy();
    expect(screen.getByText('Sample Flexi Cap Fund - Direct Plan')).toBeTruthy();
    expect(screen.getByText('New fund')).toBeTruthy();
    expect(screen.getByText('₹88.2569')).toBeTruthy();
    expect(screen.getByText('₹1,099.95')).toBeTruthy();
    expect(screen.getByText(/Units 0\.000 → 24\.578 · Invested ₹0\.00 → ₹2,199\.87/)).toBeTruthy();
    expect(screen.getByText(/SAMPLEBEES · 1 trade selling units bought before/)).toBeTruthy();
    expect(usePortfolioStore.getState().fundTxns).toHaveLength(0);

    await fireEvent(screen.getByRole('switch'), 'valueChange', false);
    expect(screen.getByRole('button', { name: 'Nothing to add' })).toBeDisabled();
    await fireEvent(screen.getByRole('switch'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Approve and add 2 trades' }));

    const state = usePortfolioStore.getState();
    expect(state.funds).toEqual([
      expect.objectContaining({
        name: 'Sample Flexi Cap Fund - Direct Plan',
        isin: 'INF000S01011',
      }),
    ]);
    expect(state.fundTxns.map((t) => [t.date, t.units, t.nav, t.amount])).toEqual([
      ['2026-09-01', 12.115, 90.7896, 109992],
      ['2026-10-01', 12.463, 88.2569, 109995],
    ]);
    expect(state.stocks).toHaveLength(0);
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when everything is already in the app', async () => {
    await renderWithProviders(<ImportTradebookSheet onClose={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose files' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Approve and add 2 trades' }));
    await renderWithProviders(<ImportTradebookSheet onClose={jest.fn()} />);
    const buttons = screen.getAllByRole('button', { name: 'Choose files' });
    await fireEvent.press(buttons[buttons.length - 1]);
    expect(
      await screen.findByText('Everything in these files is already in the app.'),
    ).toBeTruthy();
    expect(screen.getByText(/· 2 trades already in the app/)).toBeTruthy();
    expect(usePortfolioStore.getState().fundTxns).toHaveLength(2);
  });
});

describe('choosing trades in the review', () => {
  it('leaves a possible duplicate unticked and blocks an uncovered sale', async () => {
    usePortfolioStore.setState({
      ...EMPTY_PORTFOLIO,
      stocks: [stock({ id: 's1', isin: 'INF000S01029', symbol: 'SAMPLEBEES', name: 'Bees' })],
      trades: [trade('buy', '2026-08-01', { stockId: 's1', quantity: 10, price: 12000 })],
    });
    const csv = [
      'Symbol,ISIN,Trade Date,Exchange,Segment,Series,Trade Type,Auction,Quantity,Price,Trade ID',
      'SAMPLEBEES,INF000S01029,2026-08-01,NSE,EQ,EQ,buy,false,10,120.5,e1',
      'SAMPLEBEES,INF000S01029,2026-08-05,NSE,EQ,EQ,buy,false,5,121,e2',
      'SAMPLEBEES,INF000S01029,2026-08-10,NSE,EQ,EQ,sell,false,12,124,e3',
    ].join('\n');
    jest
      .mocked(pickFiles)
      .mockResolvedValue([{ name: 'equity.csv', bytes: new TextEncoder().encode(csv) }]);
    await renderWithProviders(<ImportTradebookSheet onClose={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose files' }));
    expect(await screen.findByText(/has this buy on this day at ₹120\.00/)).toBeTruthy();
    const boxes = screen.getAllByRole('checkbox');
    expect(
      boxes.map((box) => box.props.accessibilityState?.checked ?? box.props['aria-checked']),
    ).toEqual([false, true, true]);
    expect(screen.getByRole('button', { name: 'Approve and add 2 trades' })).toBeTruthy();

    // Unticking the 5-share buy leaves the 12-share sale with 10 held.
    await fireEvent.press(boxes[1]);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve and add 1 trade' })).toBeDisabled();

    await fireEvent.press(screen.getAllByRole('checkbox')[1]);
    await fireEvent.press(screen.getByRole('button', { name: 'Approve and add 2 trades' }));
    expect(usePortfolioStore.getState().trades.map((t) => [t.date, t.kind])).toEqual([
      ['2026-08-01', 'buy'],
      ['2026-08-05', 'buy'],
      ['2026-08-10', 'sell'],
    ]);
  });
});
