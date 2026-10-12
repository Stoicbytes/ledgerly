import { NOTE_LIMITS, TRASH_DAYS, type Note } from './types';

export type NoteFilter = {
  query: string;
  label: string | null;
  archived: boolean;
  /** Recently deleted instead of the notes themselves. */
  trash?: boolean;
  /** Notes with a reminder, soonest first. */
  reminders?: boolean;
};

/** Text searched for a note: title, body, checklist items and labels. */
const haystack = (note: Note) =>
  [note.title, note.body, ...(note.items ?? []).map((item) => item.text), ...note.labels]
    .join('\n')
    .toLocaleLowerCase();

/**
 * Notes for the current view, split into pinned and others (Keep's sections), each
 * most recently edited first. Archived notes show only in the archive, never pinned.
 */
export function visibleNotes(notes: Note[], filter: NoteFilter) {
  const { query, label, archived, trash, reminders } = filter;
  const needle = query.trim().toLocaleLowerCase();
  if (reminders) {
    const dated = notes
      .filter((note) => note.remindOn && !note.trashedAt && !note.archived)
      .filter((note) => !needle || haystack(note).includes(needle))
      .sort((a, b) => (a.remindOn ?? '').localeCompare(b.remindOn ?? ''));
    return { pinned: [], others: dated };
  }
  if (trash) {
    const deleted = notes
      .filter((note) => note.trashedAt)
      .filter((note) => !needle || haystack(note).includes(needle))
      .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
    return { pinned: [], others: deleted };
  }
  const matches = notes
    .filter((note) => !note.trashedAt)
    .filter((note) => note.archived === archived)
    .filter((note) => !label || note.labels.includes(label))
    .filter((note) => !needle || haystack(note).includes(needle))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return {
    pinned: archived ? [] : matches.filter((note) => note.pinned),
    others: archived ? matches : matches.filter((note) => !note.pinned),
  };
}

/** Every label in use (deleted notes aside), alphabetically (case-insensitive). */
export const allLabels = (notes: Note[]): string[] =>
  [...new Set(notes.filter((note) => !note.trashedAt).flatMap((note) => note.labels))].sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

/** A note with nothing in it is discarded instead of saved (as Keep does). */
export const isEmptyNote = (note: Pick<Note, 'title' | 'body' | 'items'>) =>
  !note.title.trim() &&
  (note.items ? note.items.every((item) => !item.text.trim()) : !note.body.trim());

/** Trims a note to the stored limits (titles, text, checklist and labels); blank list items go. */
export function clampNote<T extends Pick<Note, 'title' | 'body' | 'items' | 'labels'>>(note: T): T {
  return {
    ...note,
    title: note.title.slice(0, NOTE_LIMITS.title),
    body: note.body.slice(0, NOTE_LIMITS.body),
    items: note.items
      ? note.items
          .filter((item) => item.text.trim())
          .slice(0, NOTE_LIMITS.items)
          .map((item) => ({ ...item, text: item.text.slice(0, NOTE_LIMITS.itemText) }))
      : null,
    labels: [...new Set(note.labels.map((label) => label.trim().slice(0, NOTE_LIMITS.label)))]
      .filter(Boolean)
      .slice(0, NOTE_LIMITS.labels),
  };
}

type Content = Pick<Note, 'title' | 'body' | 'items' | 'color' | 'pinned' | 'labels' | 'remindOn'>;

/** Whether an edit changed anything (closing an untouched note must not move it to the top). */
export const sameContent = (a: Content, b: Content) =>
  a.title === b.title &&
  a.body === b.body &&
  a.color === b.color &&
  a.pinned === b.pinned &&
  (a.remindOn ?? null) === (b.remindOn ?? null) &&
  JSON.stringify(a.items) === JSON.stringify(b.items) &&
  JSON.stringify(a.labels) === JSON.stringify(b.labels);

/**
 * Why a note cannot switch between text and checklist without losing content, or null:
 * a checklist holds 200 items, and a text note 20,000 characters.
 */
export function checklistToggleProblem(note: Pick<Note, 'body' | 'items'>): string | null {
  if (note.items) {
    const length = note.items.map((item) => item.text).join('\n').length;
    return length > NOTE_LIMITS.body
      ? `Too long for a text note (${NOTE_LIMITS.body.toLocaleString('en-IN')} characters at most).`
      : null;
  }
  const lines = note.body.split('\n').filter((line) => line.trim()).length;
  return lines > NOTE_LIMITS.items
    ? `Too many lines for a checklist (${NOTE_LIMITS.items} items at most).`
    : null;
}

/** A label typed in a note, spelled like the same label already in use (any case). */
export function matchLabel(typed: string, known: string[]): string {
  const label = typed.trim().slice(0, NOTE_LIMITS.label);
  return known.find((item) => item.toLocaleLowerCase() === label.toLocaleLowerCase()) ?? label;
}

/** Text note ⇄ checklist, keeping the content: lines become items and back. */
export function toggleChecklist<T extends Pick<Note, 'body' | 'items'>>(
  note: T,
  newId: () => string,
): T {
  if (note.items) {
    return { ...note, body: note.items.map((item) => item.text).join('\n'), items: null };
  }
  const lines = note.body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    ...note,
    body: '',
    items: lines.map((text) => ({ id: newId(), text, done: false })),
  };
}

/** "3/5 done" style progress for checklist cards. */
export function checklistProgress(note: Note): { done: number; total: number } | null {
  if (!note.items) return null;
  return { done: note.items.filter((item) => item.done).length, total: note.items.length };
}

/** Notes whose reminder date has come (deleted and archived ones aside), oldest first. */
export const dueNotes = (notes: Note[], today: string): Note[] =>
  notes
    .filter((note) => note.remindOn && note.remindOn <= today && !note.archived && !note.trashedAt)
    .sort(
      (a, b) => (a.remindOn ?? '').localeCompare(b.remindOn ?? '') || b.updatedAt - a.updatedAt,
    );

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deleted notes older than TRASH_DAYS, to remove for good. */
export const expiredTrash = (notes: Note[], now: number): Note[] =>
  notes.filter((note) => note.trashedAt && now - note.trashedAt >= TRASH_DAYS * DAY_MS);

/** Whole days left before a deleted note goes for good (at least 0). */
export const trashDaysLeft = (note: Note, now: number): number =>
  Math.max(0, TRASH_DAYS - Math.floor((now - (note.trashedAt ?? now)) / DAY_MS));
