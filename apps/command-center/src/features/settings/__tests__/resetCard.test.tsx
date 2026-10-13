import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { flushCloudSync, hasUnsavedChanges, reloadCloudData } from '@/features/sync/cloudSync';
import { useSyncStatus } from '@/features/sync/syncStatus';
import { resetData, ResetUnavailableError } from '@/lib/data/resetRepository';
import { renderWithProviders } from '@/test/render';
import { ResetCard } from '../reset/ResetCard';

jest.mock('@/features/sync/cloudSync', () => ({
  flushCloudSync: jest.fn(),
  hasUnsavedChanges: jest.fn(),
  reloadCloudData: jest.fn(),
}));
jest.mock('@/lib/data/resetRepository', () => {
  const actual = jest.requireActual('@/lib/data/resetRepository');
  return { ...actual, resetData: jest.fn() };
});

beforeEach(() => {
  jest.clearAllMocks();
  useExpenseStore.getState().resetPreview();
  useRecurringStore.getState().resetPreview();
  useSyncStatus.getState().set('off');
  jest.mocked(flushCloudSync).mockResolvedValue(undefined);
  jest.mocked(reloadCloudData).mockResolvedValue(undefined);
  jest.mocked(hasUnsavedChanges).mockReturnValue(false);
});

const open = async (title: string) => {
  await renderWithProviders(<ResetCard index={0} />);
  await fireEvent.press(screen.getByRole('button', { name: `Reset ${title}` }));
};
const confirmButton = () => screen.getByRole('button', { name: 'Delete for good' });

describe('Reset data', () => {
  it('asks for RESET before clearing, and keeps accounts for an entries reset (preview)', async () => {
    const accounts = useExpenseStore.getState().accounts.length;
    await open('expense entries');
    expect(
      screen.getByText(/^This deletes [\d,]+ entries and [\d,]+ recurring entr(y|ies)\.$/),
    ).toBeTruthy();
    expect(confirmButton()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Type RESET to confirm'), 'reset');
    await fireEvent.press(confirmButton());
    await waitFor(() => expect(useExpenseStore.getState().transactions).toEqual([]));
    expect(useRecurringStore.getState().rules).toEqual([]);
    expect(useExpenseStore.getState().accounts).toHaveLength(accounts);
    expect(resetData).not.toHaveBeenCalled();
  });

  it('clears stocks only, leaving funds alone (preview)', async () => {
    const funds = usePortfolioStore.getState().funds.length;
    await open('stocks');
    await fireEvent.changeText(screen.getByLabelText('Type RESET to confirm'), 'RESET');
    await fireEvent.press(confirmButton());
    await waitFor(() => expect(usePortfolioStore.getState().stocks).toEqual([]));
    expect(usePortfolioStore.getState().trades).toEqual([]);
    expect(usePortfolioStore.getState().funds).toHaveLength(funds);
  });

  it('signed in: saves first, resets in the database, then loads again', async () => {
    useSyncStatus.getState().set('saved');
    jest.mocked(resetData).mockResolvedValue({ mf_funds: 3, investment_goals: 1 });
    await open('mutual funds');
    await fireEvent.changeText(screen.getByLabelText('Type RESET to confirm'), 'RESET');
    await fireEvent.press(confirmButton());
    await waitFor(() => expect(reloadCloudData).toHaveBeenCalled());
    expect(flushCloudSync).toHaveBeenCalled();
    expect(resetData).toHaveBeenCalledWith('mutual_funds');
    expect(await screen.findByText('Mutual funds reset: 4 items deleted.')).toBeTruthy();
  });

  it('refuses while changes wait to be saved, and explains a missing migration', async () => {
    useSyncStatus.getState().set('retrying');
    jest.mocked(hasUnsavedChanges).mockReturnValue(true);
    await open('stocks');
    await fireEvent.changeText(screen.getByLabelText('Type RESET to confirm'), 'RESET');
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(/still waiting to be saved/)).toBeTruthy();
    expect(resetData).not.toHaveBeenCalled();

    jest.mocked(hasUnsavedChanges).mockReturnValue(false);
    jest.mocked(resetData).mockRejectedValue(new ResetUnavailableError());
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(/Run database migration 0018/)).toBeTruthy();
  });
});
