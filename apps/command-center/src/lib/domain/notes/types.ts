import type { NoteColor } from '@/theme/noteColors';

export type { NoteColor };

export type ChecklistItem = { id: string; text: string; done: boolean };

/**
 * A note (Google Keep style): a text note, or a checklist when `items` is not null.
 * Mirrors the `notes` table.
 */
export type Note = {
  id: string;
  title: string;
  body: string;
  /** null = text note; otherwise the checklist (body is unused). */
  items: ChecklistItem[] | null;
  color: NoteColor;
  pinned: boolean;
  archived: boolean;
  labels: string[];
  /** A date (YYYY-MM-DD) the note should come back on; shown on Notes and Overview when due. */
  remindOn?: string | null;
  /** When it was deleted (ms): it waits in Recently deleted for TRASH_DAYS, then goes. */
  trashedAt?: number | null;
  createdAt: number;
  updatedAt: number;
};

/** Days a deleted note can still be restored. */
export const TRASH_DAYS = 7;

export const NOTE_LIMITS = {
  title: 120,
  body: 20_000,
  items: 200,
  itemText: 300,
  labels: 10,
  label: 30,
} as const;
