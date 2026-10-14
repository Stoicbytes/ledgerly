import { useSession } from '@/features/auth/sessionStore';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { loadCloudData, saveChanges, type CloudData } from '@/lib/data/ledgerRepository';
import { UNCHECKED } from '@/lib/data/saveResult';
import { loadMarket } from '@/lib/data/marketRepository';
import { EMPTY_MARKET, EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { RpcError } from '@/lib/data/rpc';
import { hasUnsavedChanges, startCloudSync, stopCloudSync } from '../cloudSync';
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

describe('unsaved changes', () => {
  it('reports a change until it is saved, and while it waits to be retried', async () => {
    await startCloudSync();
    expect(hasUnsavedChanges()).toBe(false);
    jest.mocked(saveChanges).mockRejectedValueOnce(new RpcError(0, 'network'));
    useExpenseStore.getState().saveAccount({ name: 'Bank', group: 'bank', openingBalance: 0 });
    expect(hasUnsavedChanges()).toBe(true);
    await settle();
    expect(useSyncStatus.getState().status).toBe('retrying');
    expect(hasUnsavedChanges()).toBe(true);
    await jest.advanceTimersByTimeAsync(5000);
    expect(hasUnsavedChanges()).toBe(false);
  });

  // The web page events, on the bare test environment (phones have neither).
  const page = () => {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const win = new EventTarget();
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = { document: g.document, add: g.addEventListener, remove: g.removeEventListener };
    g.document = doc;
    g.addEventListener = win.addEventListener.bind(win);
    g.removeEventListener = win.removeEventListener.bind(win);
    const restore = () => {
      g.document = saved.document;
      g.addEventListener = saved.add;
      g.removeEventListener = saved.remove;
    };
    return { doc, win, restore };
  };

  it('sends a waiting change as soon as the page is hidden', async () => {
    const { doc, restore } = page();
    await startCloudSync();
    useExpenseStore.getState().saveAccount({ name: 'Bank', group: 'bank', openingBalance: 0 });
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    await jest.advanceTimersByTimeAsync(0);
    expect(saveChanges).toHaveBeenCalledTimes(1);
    // Sent so it can finish even if the page is closed next.
    expect(saveChanges).toHaveBeenCalledWith(expect.anything(), { keepalive: true });
    stopCloudSync();
    restore();
  });

  it('asks before the page is left with an unsaved change', async () => {
    const { win, restore } = page();
    await startCloudSync();
    const quiet = new Event('beforeunload', { cancelable: true });
    win.dispatchEvent(quiet);
    expect(quiet.defaultPrevented).toBe(false);
    useExpenseStore.getState().saveAccount({ name: 'Bank', group: 'bank', openingBalance: 0 });
    const leaving = new Event('beforeunload', { cancelable: true });
    win.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    stopCloudSync();
    restore();
  });

  it('reloads when the page is shown again a minute or more later', async () => {
    const { doc, restore } = page();
    await startCloudSync();
    jest.setSystemTime(Date.now() + 61_000);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    await jest.advanceTimersByTimeAsync(0);
    expect(loadCloudData).toHaveBeenCalledTimes(2);
    stopCloudSync();
    restore();
  });
});
