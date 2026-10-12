import {
  allLabels,
  checklistProgress,
  checklistToggleProblem,
  clampNote,
  dueNotes,
  expiredTrash,
  trashDaysLeft,
  matchLabel,
  sameContent,
  isEmptyNote,
  toggleChecklist,
  visibleNotes,
} from '../notes';
import type { Note } from '../types';

const note = (patch: Partial<Note>): Note => ({
  id: 'n',
  title: '',
  body: '',
  items: null,
  color: 'default',
  pinned: false,
  archived: false,
  labels: [],
  createdAt: 0,
  updatedAt: 0,
  ...patch,
});

const notes = [
  note({
    id: 'a',
    title: 'Groceries',
    items: [{ id: 'i', text: 'Milk', done: true }],
    updatedAt: 3,
  }),
  note({
    id: 'b',
    title: 'Trip ideas',
    body: 'Ooty in May',
    pinned: true,
    labels: ['Travel'],
    updatedAt: 2,
  }),
  note({ id: 'c', title: 'Old', body: 'archived', archived: true, pinned: true, updatedAt: 5 }),
  note({ id: 'd', body: 'Call the bank', labels: ['finance', 'Travel'], updatedAt: 4 }),
];

describe('notes', () => {
  it('splits pinned and others, newest first, archive kept apart', () => {
    const view = visibleNotes(notes, { query: '', label: null, archived: false });
    expect(view.pinned.map((item) => item.id)).toEqual(['b']);
    expect(view.others.map((item) => item.id)).toEqual(['d', 'a']);
    const archive = visibleNotes(notes, { query: '', label: null, archived: true });
    expect(archive).toEqual({ pinned: [], others: [notes[2]] });
  });

  it('searches titles, text, checklist items and labels, and filters by label', () => {
    const find = (query: string, label: string | null = null) =>
      visibleNotes(notes, { query, label, archived: false }).others.map((item) => item.id);
    expect(find('milk')).toEqual(['a']);
    expect(find('BANK')).toEqual(['d']);
    expect(
      visibleNotes(notes, { query: '', label: 'Travel', archived: false }).pinned,
    ).toHaveLength(1);
    expect(find('', 'Travel')).toEqual(['d']);
  });

  it('lists labels once, alphabetically', () => {
    expect(allLabels(notes)).toEqual(['finance', 'Travel']);
  });

  it('treats a note with no title and no text as empty', () => {
    expect(isEmptyNote(note({ body: '  ' }))).toBe(true);
    expect(isEmptyNote(note({ items: [{ id: 'x', text: ' ', done: false }] }))).toBe(true);
    expect(isEmptyNote(note({ title: 'Hi' }))).toBe(false);
  });

  it('converts between text and checklist without losing content', () => {
    let next = 0;
    const list = toggleChecklist(note({ body: 'Eggs\n\n Bread ' }), () => `id${next++}`);
    expect(list.items).toEqual([
      { id: 'id0', text: 'Eggs', done: false },
      { id: 'id1', text: 'Bread', done: false },
    ]);
    expect(toggleChecklist(list, () => 'x')).toMatchObject({ body: 'Eggs\nBread', items: null });
    expect(
      checklistProgress({ ...list, items: [{ id: 'a', text: 'A', done: true }, ...list.items!] }),
    ).toEqual({
      done: 1,
      total: 3,
    });
  });

  it('clamps text and de-duplicates labels', () => {
    const clamped = clampNote(note({ title: 'x'.repeat(200), labels: ['A', ' A ', '', 'B'] }));
    expect(clamped.title).toHaveLength(120);
    expect(clamped.labels).toEqual(['A', 'B']);
  });
});

describe('edge cases', () => {
  it('drops blank checklist items when saving', () => {
    const items = [
      { id: 'a', text: 'Milk', done: false },
      { id: 'b', text: '  ', done: false },
    ];
    expect(clampNote(note({ items })).items).toEqual([items[0]]);
  });

  it('refuses a switch that would lose content', () => {
    expect(checklistToggleProblem({ body: 'a\n'.repeat(201), items: null })).toMatch(/200 items/);
    expect(checklistToggleProblem({ body: 'a\nb', items: null })).toBeNull();
    const long = Array.from({ length: 70 }, (_, i) => ({
      id: `${i}`,
      text: 'x'.repeat(300),
      done: false,
    }));
    expect(checklistToggleProblem({ body: '', items: long })).toMatch(/20,000 characters/);
  });

  it('spells a label like the one already in use', () => {
    expect(matchLabel(' finance ', ['Finance', 'Home'])).toBe('Finance');
    expect(matchLabel('Travel', ['Finance'])).toBe('Travel');
  });

  it('notices whether anything changed', () => {
    const a = note({ title: 'T', labels: ['x'] });
    expect(sameContent(a, { ...a })).toBe(true);
    expect(sameContent(a, { ...a, labels: ['y'] })).toBe(false);
  });
});

describe('reminders and Recently deleted', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse('2026-10-12T12:00:00Z');
  const list = [
    note({ id: 'due', remindOn: '2026-10-10' }),
    note({ id: 'today', remindOn: '2026-10-12' }),
    note({ id: 'later', remindOn: '2026-10-20' }),
    note({ id: 'archived', remindOn: '2026-10-01', archived: true }),
    note({ id: 'gone', remindOn: '2026-10-01', trashedAt: now - 8 * day }),
    note({ id: 'fresh', trashedAt: now - 2 * day }),
  ];

  it('lists due reminders, oldest first, without archived or deleted notes', () => {
    expect(dueNotes(list, '2026-10-12').map((n) => n.id)).toEqual(['due', 'today']);
  });

  it('keeps deleted notes out of the notes and in Recently deleted', () => {
    const filter = { query: '', label: null, archived: false };
    expect(visibleNotes(list, filter).others.map((n) => n.id)).not.toContain('fresh');
    expect(visibleNotes(list, { ...filter, trash: true }).others.map((n) => n.id)).toEqual([
      'fresh',
      'gone',
    ]);
    expect(visibleNotes(list, { ...filter, reminders: true }).others.map((n) => n.id)).toEqual([
      'due',
      'today',
      'later',
    ]);
  });

  it('expires deleted notes after 7 days', () => {
    expect(expiredTrash(list, now).map((n) => n.id)).toEqual(['gone']);
    expect(trashDaysLeft(list[5], now)).toBe(5);
  });
});
