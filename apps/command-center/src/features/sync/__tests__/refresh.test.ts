import { AppState, type AppStateStatus } from 'react-native';
import { useSession } from '@/features/auth/sessionStore';
import { cleanUnusedReceipts } from '@/features/expenses/photos/receipts';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { loadCloudData, saveChanges, type CloudData } from '@/lib/data/ledgerRepository';
import { loadMarket } from '@/lib/data/marketRepository';
import { EMPTY_MARKET, EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { REFRESH_AFTER_MS, refreshCloudData, startCloudSync, stopCloudSync } from '../cloudSync';

jest.mock('@/lib/data/marketRepository', () => ({ loadMarket: jest.fn() }));
jest.mock('@/features/expenses/photos/receipts', () => ({ cleanUnusedReceipts: jest.fn() }));
jest.mock('@/lib/data/ledgerRepository', () => ({
  ...jest.requireActual('@/lib/data/ledgerRepository'),
  loadCloudData: jest.fn(),
  saveChanges: jest.fn(),
}));

const cloud = (names = ['Cash']): CloudData => ({
  accounts: names.map((name, order) => ({
    id: `a${order}`,
    name,
    group: 'cash',
    openingBalance: 0,
    order,
  })),
  categories: [],
  people: [],
  transactions: [],
  notes: [],
  portfolio: EMPTY_PORTFOLIO,
});
const names = () => useExpenseStore.getState().accounts.map((a) => a.name);
const later = () => jest.setSystemTime(Date.now() + REFRESH_AFTER_MS + 1);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  stopCloudSync();
  useSession.setState({ status: 'signedIn', email: 'me@example.com', recovery: false });
  jest.mocked(loadCloudData).mockResolvedValue(cloud());
  jest.mocked(saveChanges).mockResolvedValue(undefined);
  jest.mocked(loadMarket).mockResolvedValue(EMPTY_MARKET);
  jest.mocked(cleanUnusedReceipts).mockResolvedValue(0);
});
afterEach(() => {
  stopCloudSync();
  jest.useRealTimers();
});

describe('coming back to the app', () => {
  it('shows changes made on another device, without sending them back', async () => {
    await startCloudSync();
    expect(cleanUnusedReceipts).toHaveBeenCalledWith([]);
    later();
    jest.mocked(loadCloudData).mockResolvedValue(cloud(['Cash', 'Bank']));
    await refreshCloudData();
    expect(names()).toEqual(['Cash', 'Bank']);
    await jest.advanceTimersByTimeAsync(1000);
    expect(saveChanges).not.toHaveBeenCalled();
  });

  it('does not reload again within a minute of the last load', async () => {
    await startCloudSync();
    await refreshCloudData();
    expect(loadCloudData).toHaveBeenCalledTimes(1);
  });

  it('never reloads over an edit that is not saved yet', async () => {
    await startCloudSync();
    useExpenseStore.getState().saveAccount({ name: 'Mine', group: 'bank', openingBalance: 0 });
    later();
    await refreshCloudData();
    expect(loadCloudData).toHaveBeenCalledTimes(1);
    expect(names()).toContain('Mine');
  });

  it('keeps an edit made while the reload was on its way, and saves it', async () => {
    await startCloudSync();
    later();
    let answer = (_: CloudData) => {};
    jest
      .mocked(loadCloudData)
      .mockImplementation(() => new Promise<CloudData>((resolve) => (answer = resolve)));
    const refreshing = refreshCloudData();
    useExpenseStore.getState().saveAccount({ name: 'Mine', group: 'bank', openingBalance: 0 });
    answer(cloud(['Cash', 'Elsewhere']));
    await refreshing;
    expect(names()).toEqual(['Cash', 'Mine']);
    await jest.advanceTimersByTimeAsync(1000);
    expect(saveChanges).toHaveBeenCalledTimes(1);
  });

  it('keeps what is on screen when offline', async () => {
    await startCloudSync();
    later();
    jest.mocked(loadCloudData).mockRejectedValue(new Error('offline'));
    await refreshCloudData();
    expect(names()).toEqual(['Cash']);
  });

  it('on phones, saves when the app goes to the background and reloads when it returns', async () => {
    let onChange: (state: AppStateStatus) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
      onChange = listener;
      return { remove } as never;
    });
    await startCloudSync();
    useExpenseStore.getState().saveAccount({ name: 'Mine', group: 'bank', openingBalance: 0 });
    onChange('background');
    await jest.advanceTimersByTimeAsync(0);
    expect(saveChanges).toHaveBeenCalledTimes(1);
    later();
    jest.mocked(loadCloudData).mockResolvedValue(cloud(['Cash', 'Mine', 'Bank']));
    onChange('active');
    await jest.advanceTimersByTimeAsync(0);
    expect(loadCloudData).toHaveBeenCalledTimes(2);
    expect(names()).toEqual(['Cash', 'Mine', 'Bank']);
    stopCloudSync();
    expect(remove).toHaveBeenCalled();
  });
});
