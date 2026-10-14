import { useSession } from '@/features/auth/sessionStore';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import {
  loadCloudData,
  saveChanges,
  type CloudData,
  type LedgerChanges,
} from '@/lib/data/ledgerRepository';
import { loadMarket } from '@/lib/data/marketRepository';
import { RpcError } from '@/lib/data/rpc';
import { UNCHECKED, type SaveResult } from '@/lib/data/saveResult';
import { EMPTY_MARKET, EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import type { Account } from '@/lib/domain/expenses';
import type { Note } from '@/lib/domain/notes';
import { flushCloudSync, hasUnsavedChanges, startCloudSync, stopCloudSync } from '../cloudSync';
import { CONFLICT_NOTICE } from '../messages';
import { useSyncStatus } from '../syncStatus';

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
const cloud = (accounts = [account('a1', 'Cash')], stamp = 'T1'): CloudData => ({
  accounts,
  categories: [],
  people: [],
  transactions: [],
  notes: [],
  portfolio: EMPTY_PORTFOLIO,
  versions: { accounts: Object.fromEntries(accounts.map((a) => [a.id, stamp])) },
});
const checked = (savedAt: string, conflicts: SaveResult['conflicts'] = []): SaveResult => ({
  checked: true,
  conflicts,
  savedAt,
});
const accounts = () => useExpenseStore.getState().accounts;
const setAccounts = (list: Account[]) => useExpenseStore.setState({ accounts: list });
const sent = (call = -1): LedgerChanges => jest.mocked(saveChanges).mock.calls.at(call)![0];
const settle = () => jest.advanceTimersByTimeAsync(1000);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  stopCloudSync();
  useSyncStatus.setState({ notices: [] });
  useSession.setState({ status: 'signedIn', email: 'me@example.com', recovery: false });
  jest.mocked(loadCloudData).mockResolvedValue(cloud());
  jest.mocked(saveChanges).mockResolvedValue(checked('T2'));
  jest.mocked(loadMarket).mockResolvedValue(EMPTY_MARKET);
});
afterEach(() => {
  stopCloudSync();
  jest.useRealTimers();
});

describe('saving safely', () => {
  it('reports whether everything was saved', async () => {
    await startCloudSync();
    jest.mocked(saveChanges).mockRejectedValue(new RpcError(0, 'network'));
    setAccounts([...accounts(), account('a2', 'Bank', 1)]);
    expect(await flushCloudSync()).toBe(false);
    expect(hasUnsavedChanges()).toBe(true);
    jest.mocked(saveChanges).mockResolvedValue(checked('T2'));
    expect(await flushCloudSync()).toBe(true);
  });

  it('drops only the row the database refuses and keeps the rest', async () => {
    await startCloudSync();
    jest.mocked(saveChanges).mockImplementation(async (changes) => {
      const rows = (changes.accounts ?? []) as { name: string }[];
      if (rows.some((row) => row.name === 'Bad')) throw new RpcError(400, '23514');
      return checked('T2');
    });
    setAccounts([account('a1', 'Wallet'), account('a2', 'Bad', 1), account('a3', 'Bank', 2)]);
    await settle();
    expect(accounts().map((a) => a.name)).toEqual(['Wallet', 'Bank']);
    await settle();
    expect(hasUnsavedChanges()).toBe(false);
    const { notices } = useSyncStatus.getState();
    expect(notices).toHaveLength(1);
    expect(notices[0].message).toContain('1 change could not be saved: account “Bad” — ');
    expect(useSyncStatus.getState().status).toBe('saved');
  });

  it('sends the version it last saw, and the new one after each save', async () => {
    await startCloudSync();
    setAccounts([account('a1', 'Wallet'), account('a2', 'Bank', 1)]);
    await settle();
    expect(sent().accounts).toEqual([
      expect.objectContaining({ id: 'a1', base_updated_at: 'T1' }),
      expect.not.objectContaining({ base_updated_at: expect.anything() }),
    ]);
    setAccounts([account('a1', 'Purse'), account('a2', 'Bank 2', 1)]);
    await settle();
    expect(sent().accounts).toEqual([
      expect.objectContaining({ id: 'a1', base_updated_at: 'T2' }),
      expect.objectContaining({ id: 'a2', base_updated_at: 'T2' }),
    ]);
  });

  it('without migration 0020 sends rows unchecked after saving them', async () => {
    jest.mocked(saveChanges).mockResolvedValue(UNCHECKED);
    await startCloudSync();
    setAccounts([account('a1', 'Wallet')]);
    await settle();
    setAccounts([account('a1', 'Purse')]);
    await settle();
    expect(sent().accounts).toEqual([
      expect.not.objectContaining({ base_updated_at: expect.anything() }),
    ]);
  });

  it('shows the newer version of a row changed elsewhere, keeping other edits', async () => {
    await startCloudSync();
    jest
      .mocked(saveChanges)
      .mockResolvedValueOnce(checked('T2', [{ list: 'accounts', id: 'a1', reason: 'changed' }]));
    jest
      .mocked(loadCloudData)
      .mockResolvedValue(cloud([account('a1', 'From phone'), account('a3', 'Other')], 'T9'));
    setAccounts([account('a1', 'Stale tab'), account('a2', 'Bank', 1)]);
    await settle();
    expect(accounts().map((a) => a.name)).toEqual(['From phone', 'Bank']);
    expect(useSyncStatus.getState().notices.map((n) => n.message)).toEqual([CONFLICT_NOTICE]);
    await settle();
    expect(hasUnsavedChanges()).toBe(false);
    setAccounts([account('a1', 'Edited again'), account('a2', 'Bank', 1)]);
    await settle();
    expect(sent().accounts).toEqual([expect.objectContaining({ base_updated_at: 'T9' })]);
  });

  it('deletes a new row that was deleted here after a save got no answer', async () => {
    await startCloudSync();
    jest.mocked(saveChanges).mockRejectedValueOnce(new RpcError(0, 'timeout'));
    setAccounts([account('a1', 'Cash'), account('a2', 'New', 1)]);
    await settle();
    expect(useSyncStatus.getState().status).toBe('retrying');
    setAccounts([account('a1', 'Cash')]);
    expect(hasUnsavedChanges()).toBe(true);
    await jest.advanceTimersByTimeAsync(5000);
    expect(sent().deleted?.accounts).toEqual(['a2']);
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('sends a large save in parts of at most 4,000 rows per list', async () => {
    await startCloudSync();
    const note = (i: number): Note => ({
      id: `n${i}`,
      title: `Note ${i}`,
      body: '',
      items: null,
      color: 'default',
      pinned: false,
      archived: false,
      labels: [],
      remindOn: null,
      trashedAt: null,
      createdAt: 1,
      updatedAt: 1,
    });
    useNotesStore.setState({ notes: Array.from({ length: 9000 }, (_, i) => note(i)) });
    setAccounts([account('a1', 'Wallet')]);
    await settle();
    const calls = jest.mocked(saveChanges).mock.calls.map(([changes]) => changes);
    expect(calls.map((c) => c.notes?.length ?? 0)).toEqual([4000, 4000, 1000]);
    expect(calls[0].accounts).toHaveLength(1);
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('keeps already saved parts when a later part fails', async () => {
    await startCloudSync();
    jest
      .mocked(saveChanges)
      .mockResolvedValueOnce(checked('T2'))
      .mockRejectedValueOnce(new RpcError(503));
    const many = Array.from({ length: 4500 }, (_, i) => account(`x${i}`, `A${i}`, i));
    setAccounts(many);
    await settle();
    expect(saveChanges).toHaveBeenCalledTimes(2);
    jest.mocked(saveChanges).mockResolvedValue(checked('T3'));
    await jest.advanceTimersByTimeAsync(5000);
    expect(sent().accounts).toHaveLength(500);
  });

  it('says the session ended instead of offline on a 401', async () => {
    await startCloudSync();
    jest.mocked(saveChanges).mockRejectedValue(new RpcError(401, 'no_session'));
    setAccounts([account('a1', 'Wallet')]);
    await settle();
    expect(useSyncStatus.getState().status).toBe('expired');
    expect(hasUnsavedChanges()).toBe(true);
  });
});
