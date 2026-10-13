import { act, fireEvent, screen } from '@testing-library/react-native';
import { accounts, categories, transactions } from '@/lib/domain/expenses/__fixtures__/ledger';
import { router } from 'expo-router';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { renderWithProviders } from '@/test/render';
import { saveTextFile } from '@/lib/files/saveTextFile';
import { useExpenseStore } from '../../state/expenseStore';
import { useSearchStore } from '../../state/searchStore';
import { periodRange } from '../SearchFilterChips';
import { SearchSheet } from '../SearchSheet';

jest.mock('@/lib/files/saveTextFile', () => ({ saveTextFile: jest.fn(async () => undefined) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  useExpenseStore.getState().restoreLedger({ accounts, categories, transactions, people: [] });
  useSearchStore.getState().clear();
  useSearchStore.getState().show();
});

describe('SearchSheet', () => {
  it('also finds notes and opens them', async () => {
    const note = useNotesStore.getState().notes[0];
    useNotesStore.setState({
      notes: [{ ...note, id: 'zz', title: 'Passport renewal', trashedAt: null }],
    });
    await renderWithProviders(<SearchSheet />);
    await fireEvent.changeText(screen.getByLabelText('Search'), 'passport');
    expect(screen.getByText('Notes')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Passport renewal/ }));
    expect(router.push).toHaveBeenCalledWith('/dashboard/notes');
    expect(useSearchStore.getState().open).toBe(false);
  });

  it('finds entries by word, with totals', async () => {
    await renderWithProviders(<SearchSheet />);
    expect(screen.getByText('Search Ledgerly')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search'), 'tea');
    expect(screen.getByText('2 entries · spent ₹90 · received ₹0')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search'), 'nothing-like-this');
    expect(screen.getByText('No entries found')).toBeTruthy();
  });

  it('filters by type and category chips', async () => {
    await renderWithProviders(<SearchSheet />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Expenses' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Rent' }));
    expect(screen.getByText('1 entry · spent ₹10,000 · received ₹0')).toBeTruthy();
  });

  it('exports every entry, or only the results, as CSV', async () => {
    await renderWithProviders(<SearchSheet />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Export all' }));
    });
    const [csv, name] = jest.mocked(saveTextFile).mock.calls[0];
    expect(csv.trim().split('\r\n')).toHaveLength(transactions.length + 1);
    expect(name).toMatch(/^expenses-\d{4}-\d{2}-\d{2}\.csv$/);
    await fireEvent.changeText(screen.getByLabelText('Search'), 'lunch');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Export results' }));
    });
    expect(jest.mocked(saveTextFile).mock.calls[1][0].trim().split('\r\n')).toHaveLength(2);
    expect(screen.getByText('Exported 1 entry')).toBeTruthy();
  });

  it('turns period chips into dates', () => {
    expect(periodRange('month', '2026-10-11')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodRange('three', '2026-01-15')).toEqual({ from: '2025-11-01', to: '2026-01-31' });
    expect(periodRange('lastYear', '2026-10-11')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(periodRange('any')).toEqual({ from: null, to: null });
  });
});
