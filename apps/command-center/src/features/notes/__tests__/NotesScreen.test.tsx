import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { NotesScreen } from '../NotesScreen';
import { useNotesStore } from '../state/notesStore';

const notes = () => useNotesStore.getState().notes;

beforeEach(() => useNotesStore.getState().resetPreview());

describe('NotesScreen', () => {
  it('shows pinned notes apart and finds notes by search', async () => {
    await renderWithProviders(<NotesScreen />);
    expect(screen.getByText('Pinned')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open pinned note: Review SIPs' })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search notes'), 'curry');
    expect(screen.queryByRole('button', { name: 'Open pinned note: Review SIPs' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open note: Groceries' })).toBeTruthy();
  });

  it('ticks a checklist item straight from the card', async () => {
    await renderWithProviders(<NotesScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Rice 5 kg' }));
    const groceries = notes().find((note) => note.id === 'note-groceries')!;
    expect(groceries.items?.find((item) => item.text === 'Rice 5 kg')?.done).toBe(true);
  });

  it('creates a note on Done and discards an empty one', async () => {
    await renderWithProviders(<NotesScreen />);
    const before = notes().length;
    await fireEvent.press(screen.getByRole('button', { name: 'Take a note' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(notes()).toHaveLength(before);
    await fireEvent.press(screen.getByRole('button', { name: 'Take a note' }));
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Ideas');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Plan the weekend');
    await fireEvent.press(screen.getByRole('radio', { name: 'mint colour' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(notes()[0]).toMatchObject({ title: 'Ideas', body: 'Plan the weekend', color: 'mint' });
  });

  it('archives a note and deletes with undo', async () => {
    await renderWithProviders(<NotesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Archive note' }));
    expect(notes().find((note) => note.id === 'note-trip')?.archived).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Archive' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete note' }));
    expect(notes().find((note) => note.id === 'note-trip')?.trashedAt).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(notes().find((note) => note.id === 'note-trip')?.trashedAt).toBeFalsy();
  });

  it('turns a text note into a checklist', async () => {
    await renderWithProviders(<NotesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Take a note' }));
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Eggs\nBread');
    await fireEvent.press(screen.getByRole('button', { name: 'Show as checklist' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(notes()[0].items?.map((item) => item.text)).toEqual(['Eggs', 'Bread']);
  });

  it('keeps an untouched note in place and deletes one emptied out, with undo', async () => {
    await renderWithProviders(<NotesScreen />);
    const before = notes().find((note) => note.id === 'note-trip')!;
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(notes().find((note) => note.id === 'note-trip')!.updatedAt).toBe(before.updatedAt);

    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    await fireEvent.changeText(screen.getByLabelText('Title'), '');
    await fireEvent.changeText(screen.getByLabelText('Note'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Empty note deleted')).toBeTruthy();
    expect(notes().find((note) => note.id === 'note-trip')?.trashedAt).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(notes().find((note) => note.id === 'note-trip')).toEqual(before);
  });

  it('goes back to all notes when the chosen label is no longer used', async () => {
    await renderWithProviders(<NotesScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Travel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove label Travel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(
      screen.getByRole('checkbox', { name: 'All notes' }).props.accessibilityState,
    ).toMatchObject({
      checked: true,
    });
    expect(screen.getByRole('button', { name: 'Open note: Groceries' })).toBeTruthy();
  });

  it('restores a deleted note from Recently deleted, or deletes it for good', async () => {
    await renderWithProviders(<NotesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete note' }));
    expect(screen.queryByRole('button', { name: 'Open note: Hometown trip' })).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Recently deleted' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    expect(screen.getByText(/Deleted for good in 7 days/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Restore' }));
    expect(notes().find((note) => note.id === 'note-trip')?.trashedAt).toBeFalsy();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'All notes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete note' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Recently deleted' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete for good' }));
    expect(notes().some((note) => note.id === 'note-trip')).toBe(false);
  });

  it('adds a reminder and lists it under Reminders', async () => {
    await renderWithProviders(<NotesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add reminder' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(notes().find((note) => note.id === 'note-trip')?.remindOn).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Reminders' }));
    expect(
      screen.getByRole('button', { name: /^Open note: Hometown trip, reminder \d+ \w+$/ }),
    ).toBeTruthy();
    expect(screen.getByText(/^Reminder · /, { includeHiddenElements: true })).toBeTruthy();
  });

  it('deletes at once and hides the extras without migration 0015', async () => {
    useNotesStore.setState({ extras: false });
    await renderWithProviders(<NotesScreen />);
    expect(screen.queryByRole('checkbox', { name: 'Recently deleted' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open note: Hometown trip' }));
    expect(screen.queryByRole('button', { name: 'Add reminder' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete note' }));
    expect(notes().some((note) => note.id === 'note-trip')).toBe(false);
  });
});
