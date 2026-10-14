import { useSession } from '@/features/auth/sessionStore';
import { cleanUnusedReceipts } from '@/features/expenses/photos/receipts';
import { createRule } from '@/features/expenses/state/recurringActions';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { loadCloudData, saveChanges, type CloudData } from '@/lib/data/ledgerRepository';
import { UNCHECKED } from '@/lib/data/saveResult';
import { loadMarket } from '@/lib/data/marketRepository';
import { EMPTY_MARKET, EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { startCloudSync, stopCloudSync } from '../cloudSync';

jest.mock('@/lib/data/marketRepository', () => ({ loadMarket: jest.fn() }));
jest.mock('@/features/expenses/photos/receipts', () => ({ cleanUnusedReceipts: jest.fn() }));
jest.mock('@/lib/data/ledgerRepository', () => ({
  ...jest.requireActual('@/lib/data/ledgerRepository'),
  loadCloudData: jest.fn(),
  saveChanges: jest.fn(),
}));

const cloud = (recurring?: CloudData['recurring']): CloudData => ({
  accounts: [{ id: 'a1', name: 'Cash', group: 'cash', openingBalance: 0, order: 0 }],
  categories: [
    {
      id: 'c1',
      kind: 'expense',
      parentId: null,
      name: 'Rent',
      icon: 'home',
      tint: 0,
      budget: null,
      order: 0,
    },
  ],
  people: [],
  transactions: [],
  notes: [],
  portfolio: EMPTY_PORTFOLIO,
  recurring,
});
const rent = {
  kind: 'expense' as const,
  date: '2026-10-01',
  amount: 100,
  accountId: 'a1',
  toAccountId: null,
  fee: 0,
  categoryId: 'c1',
  note: '',
  splits: [],
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  stopCloudSync();
  useSession.setState({ status: 'signedIn', email: 'me@example.com', recovery: false });
  jest.mocked(saveChanges).mockResolvedValue(UNCHECKED);
  jest.mocked(loadMarket).mockResolvedValue(EMPTY_MARKET);
  jest.mocked(cleanUnusedReceipts).mockResolvedValue(0);
});
afterEach(() => {
  stopCloudSync();
  jest.useRealTimers();
});

describe('recurring entries and the cloud', () => {
  it('hides Repeat while the database has no recurring entries (migration 0012)', async () => {
    jest.mocked(loadCloudData).mockResolvedValue(cloud(undefined));
    await startCloudSync();
    expect(useRecurringStore.getState()).toMatchObject({ rules: [], available: false });
  });

  it('loads them and saves a new one', async () => {
    jest.mocked(loadCloudData).mockResolvedValue(cloud([]));
    await startCloudSync();
    expect(useRecurringStore.getState().available).toBe(true);
    createRule(rent, 'monthly');
    await jest.advanceTimersByTimeAsync(1000);
    expect(jest.mocked(saveChanges).mock.calls[0][0].recurring).toEqual([
      expect.objectContaining({ frequency: 'monthly', next_date: '2026-11-01', category_id: 'c1' }),
    ]);
  });
});
