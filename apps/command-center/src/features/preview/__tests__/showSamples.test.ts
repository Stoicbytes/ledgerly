import { useSession } from '@/features/auth/sessionStore';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { showSamples } from '../showSamples';

const empty = { accounts: [], categories: [], transactions: [], people: [] };

describe('showSamples', () => {
  it('fills the stores with sample data in preview mode', async () => {
    useSession.getState().setPreview();
    useExpenseStore.setState(empty);
    useNotesStore.setState({ notes: [] });
    expect(await showSamples()).toBe(true);
    expect(useExpenseStore.getState().transactions.length).toBeGreaterThan(0);
    expect(useNotesStore.getState().notes.length).toBeGreaterThan(0);
  });

  it('never puts sample data in front of a signed-in user', async () => {
    useSession.getState().setSignedIn('someone@example.com');
    useExpenseStore.setState(empty);
    expect(await showSamples()).toBe(false);
    expect(useExpenseStore.getState().transactions).toEqual([]);
  });
});
