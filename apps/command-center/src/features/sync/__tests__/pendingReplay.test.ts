import { useSession } from '@/features/auth/sessionStore';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { loadCloudData, saveChanges, type CloudData } from '@/lib/data/ledgerRepository';
import { loadMarket } from '@/lib/data/marketRepository';
import { RpcError } from '@/lib/data/rpc';
import { EMPTY_MARKET, EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import type { Account } from '@/lib/domain/expenses';
import {
  discardUnsavedChanges,
  hasUnsavedChanges,
  startCloudSync,
  stopCloudSync,
} from '../cloudSync';
import { readPending } from '../pendingStore';
import { useSyncStatus } from '../syncStatus';

const mockKept = new Map<string, string>();
jest.mock('../pendingStore', () => ({
  writePending: (user: string, value: string) => Boolean(mockKept.set(user, value)),
  readPending: (user: string) => mockKept.get(user) ?? null,
  clearPending: (user: string) => void mockKept.delete(user),
}));
jest.mock('@/lib/data/marketRepository', () => ({ loadMarket: jest.fn() }));
jest.mock('@/features/expenses/photos/receipts', () => ({
  cleanUnusedReceipts: jest.fn(async () => 0),
}));
jest.mock('@/lib/data/ledgerRepository', () => ({
  ...jest.requireActual('@/lib/data/ledgerRepository'),
  loadCloudData: jest.fn(),
  saveChanges: jest.fn(),
}));

const account = (id: string, name: string, order = 0): Account => ({
  id,
  name,
  group: 'cash',
  openingBalance: 0,
  order,
});
const cloud = (list = [account('a1', 'Cash')], stamp = 'T1'): CloudData => ({
  accounts: list,
  categories: [],
  people: [],
  transactions: [],
  notes: [],
  portfolio: EMPTY_PORTFOLIO,
  versions: { accounts: Object.fromEntries(list.map((a) => [a.id, stamp])) },
});
const names = () => useExpenseStore.getState().accounts.map((a) => a.name);
const signIn = (userId: string) =>
  useSession.setState({ status: 'signedIn', email: 'me@example.com', userId, recovery: false });
const saved = { checked: true, conflicts: [], savedAt: 'T2' };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  stopCloudSync();
  mockKept.clear();
  useSyncStatus.setState({ notices: [] });
  signIn('user-1');
  jest.mocked(loadCloudData).mockResolvedValue(cloud());
  jest.mocked(saveChanges).mockResolvedValue(saved);
  jest.mocked(loadMarket).mockResolvedValue(EMPTY_MARKET);
});
afterEach(() => {
  stopCloudSync();
  jest.useRealTimers();
});

/** An edit that cannot be sent, then the session ends (idle, expiry, another tab). */
async function leaveUnsaved() {
  await startCloudSync();
  jest.mocked(saveChanges).mockRejectedValue(new RpcError(0, 'network'));
  useExpenseStore.setState({ accounts: [account('a1', 'Wallet'), account('a2', 'Bank', 1)] });
  await jest.advanceTimersByTimeAsync(1000);
  expect(readPending('user-1')).not.toBeNull();
  stopCloudSync();
  useExpenseStore.getState().resetPreview();
  jest.mocked(saveChanges).mockReset().mockResolvedValue(saved);
}

describe('unsaved changes kept on this device', () => {
  it('are saved on the same user’s next sign-in, and the user is told', async () => {
    await leaveUnsaved();
    await startCloudSync();
    expect(names()).toEqual(['Wallet', 'Bank']);
    await jest.advanceTimersByTimeAsync(1000);
    expect(jest.mocked(saveChanges).mock.calls[0][0].accounts).toHaveLength(2);
    expect(useSyncStatus.getState().notices.map((n) => n.message)).toEqual([
      '2 unsaved changes from your last visit were saved',
    ]);
    expect(readPending('user-1')).toBeNull();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('never go into another user’s account', async () => {
    await leaveUnsaved();
    signIn('user-2');
    await startCloudSync();
    expect(names()).toEqual(['Cash']);
    await jest.advanceTimersByTimeAsync(1000);
    expect(saveChanges).not.toHaveBeenCalled();
    expect(readPending('user-1')).not.toBeNull();
  });

  it('leave out a row changed on another device since', async () => {
    await leaveUnsaved();
    jest.mocked(loadCloudData).mockResolvedValue(cloud([account('a1', 'Phone')], 'T5'));
    await startCloudSync();
    expect(names()).toEqual(['Phone', 'Bank']);
    expect(useSyncStatus.getState().notices[0].message).toMatch(/^1 unsaved change .* not applied/);
  });

  it('are dropped when the user signs out on purpose without saving', async () => {
    await startCloudSync();
    jest.mocked(saveChanges).mockRejectedValue(new RpcError(0, 'network'));
    useExpenseStore.setState({ accounts: [account('a1', 'Wallet')] });
    await jest.advanceTimersByTimeAsync(1000);
    discardUnsavedChanges();
    stopCloudSync();
    expect(readPending('user-1')).toBeNull();
  });
});
