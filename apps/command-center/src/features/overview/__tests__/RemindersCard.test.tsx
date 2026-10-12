import { fireEvent, screen } from '@testing-library/react-native';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { addDays, todayIso } from '@/lib/domain/expenses';
import { renderWithProviders } from '@/test/render';
import { RemindersCard } from '../RemindersCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const remind = (id: string, remindOn: string) =>
  useNotesStore.getState().patchNote(id, { remindOn });

beforeEach(() => useNotesStore.getState().resetPreview());

describe('RemindersCard', () => {
  it('shows nothing when no reminder is due', async () => {
    remind('note-trip', addDays(todayIso(), 3));
    await renderWithProviders(<RemindersCard />);
    expect(screen.queryByText('Reminders due')).toBeNull();
  });

  it('lists due notes and clears one with Done', async () => {
    remind('note-trip', todayIso());
    remind('note-groceries', addDays(todayIso(), -2));
    await renderWithProviders(<RemindersCard />);
    expect(screen.getByText('Reminders due')).toBeTruthy();
    expect(screen.getByText('2 notes from Notes')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Done: Hometown trip' }));
    const trip = useNotesStore.getState().notes.find((note) => note.id === 'note-trip');
    expect(trip?.remindOn).toBeNull();
  });

  it('stays hidden without migration 0015', async () => {
    remind('note-trip', todayIso());
    useNotesStore.setState({ extras: false });
    await renderWithProviders(<RemindersCard />);
    expect(screen.queryByText('Reminders due')).toBeNull();
  });
});
