import { create } from 'zustand';
import {
  clampNote,
  expiredTrash,
  isEmptyNote,
  sameContent,
  type ChecklistItem,
  type Note,
} from '@/lib/domain/notes';
import { newId } from '@/lib/ids';
import { seedNotes } from './seedNotes';

/**
 * Notes in memory. Signed in, cloud sync loads them and saves every change to the `notes`
 * table; in the preview they are sample notes that reset on reload.
 */
export type NoteDraft = Pick<
  Note,
  'title' | 'body' | 'items' | 'color' | 'pinned' | 'labels' | 'remindOn'
>;

type NotesState = {
  notes: Note[];
  /**
   * Reminders and Recently deleted can be kept (always in the preview; signed in, once
   * migration 0015 is applied). Without them, deleting removes the note at once.
   */
  extras: boolean;
  /** Saves a new or edited note; an empty new note is discarded (returns null). */
  saveNote: (draft: NoteDraft, id?: string | null) => Note | null;
  patchNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void;
  toggleItem: (id: string, itemId: string) => void;
  /** Moves a note to Recently deleted (or removes it); returns it so the caller can offer Undo. */
  deleteNote: (id: string) => Note | null;
  /** Puts a note back exactly as it was (Undo). */
  restoreNote: (note: Note) => void;
  /** Brings a note back from Recently deleted. */
  untrashNote: (id: string) => void;
  /** Removes notes for good (from Recently deleted). */
  eraseNotes: (ids: string[]) => void;
  /** Removes deleted notes older than TRASH_DAYS. */
  purgeTrash: (now?: number) => void;
  resetPreview: () => void;
};

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: seedNotes(),
  extras: true,

  saveNote: (draft, id) => {
    const existing = id ? get().notes.find((note) => note.id === id) : undefined;
    const clean = clampNote(draft);
    if (!existing && isEmptyNote(clean)) return null;
    // Closing an untouched note keeps its place (notes are ordered by last edit).
    if (existing && sameContent(existing, clean)) return existing;
    const now = Date.now();
    const note: Note = {
      ...clean,
      id: existing?.id ?? newId(),
      archived: existing?.archived ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    set((state) => ({
      notes: existing
        ? state.notes.map((item) => (item.id === note.id ? note : item))
        : [note, ...state.notes],
    }));
    return note;
  },

  patchNote: (id, patch) =>
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id
          ? {
              ...note,
              ...patch,
              // Archiving unpins, as in Keep.
              pinned: patch.archived ? false : (patch.pinned ?? note.pinned),
              updatedAt: Date.now(),
            }
          : note,
      ),
    })),

  toggleItem: (id, itemId) =>
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id && note.items
          ? {
              ...note,
              items: note.items.map((item): ChecklistItem =>
                item.id === itemId ? { ...item, done: !item.done } : item,
              ),
              updatedAt: Date.now(),
            }
          : note,
      ),
    })),

  deleteNote: (id) => {
    const removed = get().notes.find((note) => note.id === id) ?? null;
    if (!removed) return null;
    const trashedAt = Date.now();
    set((state) => ({
      notes: state.extras
        ? state.notes.map((note) => (note.id === id ? { ...note, trashedAt } : note))
        : state.notes.filter((note) => note.id !== id),
    }));
    return removed;
  },

  untrashNote: (id) =>
    set((state) => ({
      notes: state.notes.map((note) => (note.id === id ? { ...note, trashedAt: null } : note)),
    })),

  eraseNotes: (ids) =>
    set((state) => ({ notes: state.notes.filter((note) => !ids.includes(note.id)) })),

  purgeTrash: (now = Date.now()) => {
    const expired = expiredTrash(get().notes, now).map((note) => note.id);
    if (expired.length) get().eraseNotes(expired);
  },

  restoreNote: (note) =>
    set((state) => ({ notes: [note, ...state.notes.filter((item) => item.id !== note.id)] })),

  resetPreview: () => set({ notes: seedNotes(), extras: true }),
}));
