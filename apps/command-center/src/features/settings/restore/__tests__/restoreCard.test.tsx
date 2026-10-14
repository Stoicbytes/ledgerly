import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { applyToStores } from '@/features/sync/stores';
import { emptyData, sampleData, u } from '@/lib/domain/backup/__fixtures__/sample';
import { renderWithProviders } from '@/test/render';
import { buildExport } from '../../exportAll';
import { RestoreCard } from '../RestoreCard';

const mockPick = jest.fn();
jest.mock('@/features/investments/import/pickFiles', () => ({
  canPickFiles: true,
  pickFiles: (...args: unknown[]) => mockPick(...args),
}));

const fileOf = (text: string) => [
  { name: 'ledgerly-export.json', bytes: new TextEncoder().encode(text) },
];

describe('restore from backup (preview)', () => {
  beforeEach(() => {
    applyToStores(emptyData());
    mockPick.mockReset();
  });

  it('reviews a backup, restores what is missing and can undo it', async () => {
    mockPick.mockResolvedValue(fileOf(JSON.stringify(buildExport(sampleData(), null))));
    await renderWithProviders(<RestoreCard index={0} />);
    await fireEvent.press(screen.getByRole('button', { name: /choose backup file/i }));
    expect(mockPick).toHaveBeenCalledWith(expect.objectContaining({ maxBytes: 20 * 1024 * 1024 }));
    expect(await screen.findByText(/Entries: 4 in the file, 4 to add\./)).toBeTruthy();
    expect(screen.getByText(/Receipt photos and portfolio images are not in backups/)).toBeTruthy();
    expect(useExpenseStore.getState().transactions).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: /restore 23 records/i }));
    expect(await screen.findByText(/Restored 23 records/)).toBeTruthy();
    expect(screen.getByText('Preview: nothing is saved.')).toBeTruthy();
    expect(useExpenseStore.getState().transactions).toHaveLength(4);
    expect(usePortfolioStore.getState().funds.map((f) => f.id)).toEqual([u(80)]);
    expect(useNotesStore.getState().notes).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: /undo restore/i }));
    expect(await screen.findByText(/Restore undone: 23 records removed/)).toBeTruthy();
    expect(useExpenseStore.getState().transactions).toHaveLength(0);
    expect(usePortfolioStore.getState().funds).toHaveLength(0);
  });

  it('says why a file is refused and adds nothing', async () => {
    mockPick.mockResolvedValue(fileOf('{"format":"ledgerly-export","version":1,"__proto__":{}}'));
    await renderWithProviders(<RestoreCard index={0} />);
    await fireEvent.press(screen.getByRole('button', { name: /choose backup file/i }));
    expect(await screen.findByText(/key named __proto__/)).toBeTruthy();
    expect(useExpenseStore.getState().accounts).toHaveLength(0);
  });

  it('tells when everything is already here', async () => {
    applyToStores(sampleData());
    mockPick.mockResolvedValue(fileOf(JSON.stringify(buildExport(sampleData(), null))));
    await renderWithProviders(<RestoreCard index={0} />);
    await fireEvent.press(screen.getByRole('button', { name: /choose backup file/i }));
    await waitFor(() => expect(screen.getByText(/already here: nothing to add/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: /^restore/i })).toBeNull();
  });
});
