import { act, renderHook } from '@testing-library/react-native';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { pickFiles } from '@/features/investments/import/pickFiles';
import { flushCloudSync } from '@/features/sync/cloudSync';
import { useSyncStatus } from '@/features/sync/syncStatus';
import { saveLine } from '../SheetImportCard';
import { useSheetImport } from '../useSheetImport';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: () => null }));
jest.mock('@/features/investments/import/pickFiles', () => ({ pickFiles: jest.fn() }));
jest.mock('@/features/sync/cloudSync', () => ({ flushCloudSync: jest.fn() }));

const csv = [
  'Period,Accounts,Category,Subcategory,Note,Amount,Income/Expense',
  '2026-08-14,Old bank,Food,Tea,Canteen,15,Exp.',
].join('\n');

async function importOnce() {
  jest
    .mocked(pickFiles)
    .mockResolvedValue([{ name: 'export.csv', bytes: new TextEncoder().encode(csv) }] as never);
  const hook = await renderHook(() => useSheetImport());
  await act(() => hook.result.current.choose());
  expect(hook.result.current.state.phase).toBe('review');
  await act(() => hook.result.current.approve());
  return hook.result.current.state;
}

beforeEach(() => {
  jest.clearAllMocks();
  useExpenseStore.getState().resetPreview();
  useSyncStatus.getState().set('saved');
});

describe('import save state', () => {
  it('is saved only once the database confirms it', async () => {
    jest.mocked(flushCloudSync).mockResolvedValue(true);
    const state = await importOnce();
    expect(state.phase === 'done' && state.save).toEqual({ state: 'saved' });
  });

  it('is not saved while the entries wait on this device', async () => {
    jest.mocked(flushCloudSync).mockResolvedValue(false);
    const state = await importOnce();
    expect(state.phase === 'done' && state.save).toEqual({ state: 'notSaved', refused: 0 });
    expect(saveLine({ state: 'notSaved', refused: 0 }, 1)).toMatch(/^Not saved yet/);
  });

  it('counts entries the database refused', async () => {
    jest.mocked(flushCloudSync).mockImplementation(async () => {
      useExpenseStore.getState().resetPreview();
      return true;
    });
    const state = await importOnce();
    expect(state.phase === 'done' && state.save).toEqual({ state: 'notSaved', refused: 1 });
  });

  it('says preview imports are not saved', async () => {
    useSyncStatus.getState().set('off');
    const state = await importOnce();
    expect(state.phase === 'done' && state.save).toEqual({ state: 'preview' });
    expect(flushCloudSync).not.toHaveBeenCalled();
  });
});
