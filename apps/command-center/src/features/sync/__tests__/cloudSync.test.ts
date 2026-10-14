import { useSession } from '@/features/auth/sessionStore';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { loadCloudData, saveChanges, type CloudData } from '@/lib/data/ledgerRepository';
import { UNCHECKED } from '@/lib/data/saveResult';
import { loadMarket } from '@/lib/data/marketRepository';
import { EMPTY_MARKET, EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { RpcError } from '@/lib/data/rpc';
import { flushCloudSync, startCloudSync, stopCloudSync } from '../cloudSync';
import { addStarterLedger } from '../starter';
import { useSyncStatus } from '../syncStatus';

jest.mock('@/lib/data/marketRepository', () => ({ loadMarket: jest.fn() }));
jest.mock('@/lib/data/ledgerRepository', () => ({
  ...jest.requireActual('@/lib/data/ledgerRepository'),
  loadCloudData: jest.fn(),
  saveChanges: jest.fn(),
}));

const cloud = (): CloudData => ({
  accounts: [{ id: 'a1', name: 'Cash', group: 'cash', openingBalance: 0, order: 0 }],
  categories: [],
  people: [],
  transactions: [],
  notes: [],
  portfolio: EMPTY_PORTFOLIO,
});

beforeEach(() => {
  jest.useFakeTimers();
  useSyncStatus.setState({ notices: [] });
  jest.clearAllMocks();
  stopCloudSync();
  useSession.setState({ status: 'signedIn', email: 'me@example.com', recovery: false });
  jest.mocked(loadCloudData).mockResolvedValue(cloud());
  jest.mocked(saveChanges).mockResolvedValue(UNCHECKED);
  jest.mocked(loadMarket).mockResolvedValue(EMPTY_MARKET);
});
afterEach(() => {
  stopCloudSync();
  jest.useRealTimers();
});

const settle = async () => {
  await jest.advanceTimersByTimeAsync(1000);
};

describe('cloud sync', () => {
  it('replaces the sample data with the user’s own, without sending it back', async () => {
    await startCloudSync();
    expect(useExpenseStore.getState().accounts.map((a) => a.id)).toEqual(['a1']);
    expect(useExpenseStore.getState().transactions).toEqual([]);
    expect(useNotesStore.getState().notes).toEqual([]);
    expect(useSyncStatus.getState().status).toBe('saved');
    await settle();
    expect(saveChanges).not.toHaveBeenCalled();
  });

  it('sends a change once, shortly after it is made', async () => {
    await startCloudSync();
    useExpenseStore.getState().saveAccount({ name: 'Bank', group: 'bank', openingBalance: 0 });
    useExpenseStore.getState().saveAccount({ name: 'Wallet', group: 'wallet', openingBalance: 0 });
    await settle();
    expect(saveChanges).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveChanges).mock.calls[0][0].accounts).toHaveLength(2);
    expect(useSyncStatus.getState().status).toBe('saved');
    await settle();
    expect(saveChanges).toHaveBeenCalledTimes(1);
  });

  it('keeps a change and retries when offline', async () => {
    await startCloudSync();
    jest.mocked(saveChanges).mockRejectedValueOnce(new RpcError(0, 'network'));
    useExpenseStore.getState().saveAccount({ name: 'Bank', group: 'bank', openingBalance: 0 });
    await settle();
    expect(useSyncStatus.getState().status).toBe('retrying');
    await jest.advanceTimersByTimeAsync(5000);
    expect(saveChanges).toHaveBeenCalledTimes(2);
    expect(useSyncStatus.getState().status).toBe('saved');
  });

  it('rolls back a change the database refuses, and says so until dismissed', async () => {
    await startCloudSync();
    jest.mocked(saveChanges).mockRejectedValueOnce(new RpcError(400, '23514'));
    useExpenseStore.getState().saveAccount({ name: 'Bank', group: 'bank', openingBalance: 0 });
    await settle();
    expect(useExpenseStore.getState().accounts.map((a) => a.name)).toEqual(['Cash']);
    const [notice] = useSyncStatus.getState().notices;
    expect(notice.message).toMatch(/^1 change could not be saved: account “Bank” — /);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(useSyncStatus.getState().notices).toHaveLength(1);
    useSyncStatus.getState().dismiss(notice.id);
    expect(useSyncStatus.getState().notices).toHaveLength(0);
  });

  it('never sends the sign-out clearing as a deletion', async () => {
    await startCloudSync();
    stopCloudSync();
    useSession.setState({ status: 'signedOut', email: null });
    useExpenseStore.getState().resetPreview();
    useNotesStore.getState().resetPreview();
    await settle();
    expect(saveChanges).not.toHaveBeenCalled();
    expect(useSyncStatus.getState().status).toBe('off');
  });

  it('does not write when the session is no longer signed in', async () => {
    await startCloudSync();
    useSession.setState({ status: 'signedOut', email: null });
    useExpenseStore.setState({ accounts: [] });
    await settle();
    expect(saveChanges).not.toHaveBeenCalled();
  });

  it('flushes waiting changes on demand (before signing out)', async () => {
    await startCloudSync();
    useExpenseStore.getState().saveAccount({ name: 'Bank', group: 'bank', openingBalance: 0 });
    await flushCloudSync();
    expect(saveChanges).toHaveBeenCalledTimes(1);
  });

  it('shows an error state when the data cannot be loaded', async () => {
    jest.mocked(loadCloudData).mockRejectedValueOnce(new RpcError(0, 'network'));
    await startCloudSync();
    expect(useSyncStatus.getState().status).toBe('loadFailed');
  });
});

describe('starter ledger', () => {
  it('adds categories with new ids, no budgets, and a Cash account', async () => {
    jest.mocked(loadCloudData).mockResolvedValue({ ...cloud(), accounts: [] });
    await startCloudSync();
    addStarterLedger();
    const { categories, accounts } = useExpenseStore.getState();
    const uuid = /^[0-9a-f-]{36}$/;
    expect(categories.length).toBeGreaterThan(10);
    expect(categories.every((c) => uuid.test(c.id) && c.budget === null)).toBe(true);
    expect(
      categories
        .filter((c) => c.parentId)
        .every((c) => categories.some((p) => p.id === c.parentId)),
    ).toBe(true);
    expect(accounts).toEqual([expect.objectContaining({ name: 'Cash', openingBalance: 0 })]);
  });
});

describe('investments', () => {
  it('replaces the sample portfolio and saves fund changes in the same batch', async () => {
    usePortfolioStore.getState().resetPreview();
    expect(usePortfolioStore.getState().funds.length).toBeGreaterThan(0);
    await startCloudSync();
    expect(usePortfolioStore.getState().funds).toEqual([]);
    expect(useMarketStore.getState().mode).toBe('cloud');
    expect(loadMarket).toHaveBeenCalled();
    usePortfolioStore.getState().saveFund({
      schemeCode: null,
      name: 'My fund',
      category: '',
      fundHouse: '',
      folio: '',
      manualNav: 10,
      manualNavDate: '2026-10-01',
      note: '',
    });
    await settle();
    const changes = jest.mocked(saveChanges).mock.calls.at(-1)?.[0];
    expect(changes?.mf_funds).toEqual([
      expect.objectContaining({ name: 'My fund', manual_nav: 10 }),
    ]);
  });

  it('loads prices again only when a saved change adds a priced holding', async () => {
    await startCloudSync();
    await settle();
    expect(loadMarket).toHaveBeenCalledTimes(1);
    const fund = {
      name: 'Index fund',
      category: '',
      fundHouse: '',
      folio: '',
      manualNav: null,
      manualNavDate: null,
      note: '',
    };
    usePortfolioStore.getState().saveFund({ ...fund, schemeCode: null });
    await settle();
    expect(loadMarket).toHaveBeenCalledTimes(1);
    usePortfolioStore.getState().saveFund({ ...fund, name: 'AMFI fund', schemeCode: 120716 });
    await settle();
    expect(loadMarket).toHaveBeenCalledTimes(2);
  });
});
