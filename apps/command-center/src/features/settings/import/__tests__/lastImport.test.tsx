import { fireEvent, screen } from '@testing-library/react-native';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useSyncStatus } from '@/features/sync/syncStatus';
import { planSheetImport, readExpenseSheet } from '@/lib/domain/expenses/sheetImports';
import { renderWithProviders } from '@/test/render';
import { SheetImportCard } from '../SheetImportCard';
import { lastImportOf, readLastImport, saveLastImport, undoLastImport } from '../lastImport';

const mockPrefs = new Map<string, string>();
jest.mock('@/lib/device/prefs', () => ({
  readPref: async (key: string) => mockPrefs.get(key) ?? null,
  writePref: async (key: string, value: string | null) => {
    if (value === null) mockPrefs.delete(key);
    else mockPrefs.set(key, value);
  },
}));
jest.mock('@/lib/data/rpc', () => ({
  currentSession: async () => ({ token: 't', userId: 'user-1' }),
}));
jest.mock('@/features/investments/import/pickFiles', () => ({
  canPickFiles: true,
  pickFiles: jest.fn(),
}));

const KEY = 'ledgerly.lastImport.user-1';
const sheet = [
  ['Period', 'Accounts', 'Category', 'Subcategory', 'Note', 'Amount', 'Income/Expense'],
  [46248.45, 'Old bank', 'Food', 'Tea', 'Canteen', 15, 'Exp.'],
  [46249.5, 'Old bank', 'Pocket money', '', '', 2000, 'Income'],
];

function importSheet() {
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
  const plan = planSheetImport(readExpenseSheet(sheet), useExpenseStore.getState(), id);
  useExpenseStore.getState().addImported(plan);
  return plan;
}

describe('undo last import after a reload', () => {
  beforeEach(() => {
    mockPrefs.clear();
    useExpenseStore.getState().resetPreview();
  });

  it('keeps only ids on the device and reads them back', async () => {
    const plan = importSheet();
    await saveLastImport(KEY, lastImportOf(plan));
    const stored = mockPrefs.get(KEY)!;
    expect(stored).not.toMatch(/Old bank|Canteen|2000/);
    expect((await readLastImport(KEY))?.transactions).toEqual(plan.transactions.map((t) => t.id));
    mockPrefs.set(KEY, '{"at":"x","transactions":[{"bad":1}],"accounts":[],"categories":[]}');
    expect(await readLastImport(KEY)).toBeNull();
  });

  it('skips entries already deleted and keeps accounts used elsewhere', () => {
    const plan = importSheet();
    const last = lastImportOf(plan);
    const store = useExpenseStore.getState();
    const account = plan.accounts[0].id;
    // One imported entry deleted by hand, and a new entry on the imported account.
    const [first, second] = plan.transactions;
    store.restoreLedger({
      ...store,
      transactions: [
        ...store.transactions.filter((t) => t.id !== first.id),
        { ...second, id: 'later', categoryId: null },
      ],
    });
    expect(undoLastImport(last)).toBe(1);
    const after = useExpenseStore.getState();
    expect(after.transactions.some((t) => t.id === second.id)).toBe(false);
    expect(after.transactions.some((t) => t.id === 'later')).toBe(true);
    expect(after.accounts.some((a) => a.id === account)).toBe(true);
  });

  it('offers the undo on the import card until it is dismissed', async () => {
    const plan = importSheet();
    await saveLastImport(KEY, lastImportOf(plan));
    useSyncStatus.getState().set('saved');
    await renderWithProviders(<SheetImportCard index={0} />);
    expect(await screen.findByText(/Your last import \(2 entries/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /undo last import/i }));
    expect(await screen.findByText('Import undone: 2 entries removed.')).toBeTruthy();
    expect(mockPrefs.has(KEY)).toBe(false);
    expect(useExpenseStore.getState().accounts.some((a) => a.name === 'Old bank')).toBe(false);
    useSyncStatus.getState().set('off');
  });

  it('dismiss forgets it', async () => {
    await saveLastImport(KEY, lastImportOf(importSheet()));
    useSyncStatus.getState().set('saved');
    await renderWithProviders(<SheetImportCard index={0} />);
    await fireEvent.press(await screen.findByRole('button', { name: /dismiss/i }));
    expect(mockPrefs.has(KEY)).toBe(false);
    expect(screen.queryByText(/Your last import/)).toBeNull();
    useSyncStatus.getState().set('off');
  });
});
