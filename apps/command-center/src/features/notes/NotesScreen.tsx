import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Archive, Bell, ListChecks, StickyNote, Trash2 } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { IconButton, Text } from '@/components/ui';
import { allLabels, TRASH_DAYS, visibleNotes, type Note } from '@/lib/domain/notes';
import { SampleDataBadge } from '@/features/preview/SampleDataBadge';
import { useTheme } from '@/theme';
import { NoteEditor } from './components/NoteEditor';
import { NoteGrid } from './components/NoteGrid';
import { NotesFilters, type NotesView } from './components/NotesFilters';
import { TrashedNoteSheet } from './components/TrashedNoteSheet';
import { useNotesStore } from './state/notesStore';

type Editing = { note: Note | null; checklist?: boolean } | null;

const EMPTY: Record<NotesView, { title: string; body: string }> = {
  notes: { title: 'No notes yet', body: 'Notes you add appear here.' },
  reminders: { title: 'No reminders', body: 'Open a note and press the bell to add one.' },
  archive: { title: 'Nothing archived', body: 'Archived notes appear here.' },
  trash: {
    title: 'Nothing deleted',
    body: `Deleted notes wait here for ${TRASH_DAYS} days before they go for good.`,
  },
};

/**
 * Notes (Google Keep style): quick capture, pinned and other notes, labels, reminders,
 * archive, Recently deleted and search.
 */
export function NotesScreen() {
  const theme = useTheme();
  const { notes, extras } = useNotesStore();
  const [query, setQuery] = useState('');
  const [chosen, setLabel] = useState<string | null>(null);
  const [picked, setView] = useState<NotesView>('notes');
  const [editing, setEditing] = useState<Editing>(null);
  const [trashed, setTrashed] = useState<Note | null>(null);
  // Reminders and Recently deleted disappear when the database cannot keep them.
  const view = !extras && (picked === 'reminders' || picked === 'trash') ? 'notes' : picked;
  const labels = useMemo(() => allLabels(notes), [notes]);
  // A label whose last note was deleted or relabelled falls back to all notes.
  const label = view === 'notes' && chosen && labels.includes(chosen) ? chosen : null;
  const shown = useMemo(
    () =>
      visibleNotes(notes, {
        query,
        label,
        archived: view === 'archive',
        trash: view === 'trash',
        reminders: view === 'reminders',
      }),
    [notes, query, label, view],
  );
  const open = (note: Note) => (view === 'trash' ? setTrashed(note) : setEditing({ note }));
  const empty = !shown.pinned.length && !shown.others.length;
  const emptyText = query
    ? { title: 'No notes match', body: 'Try another word, or clear the search.' }
    : EMPTY[view];
  return (
    <Screen>
      <PageHeader title="Notes" meta={<SampleDataBadge editable />} size="compact" />
      <NotesFilters
        query={query}
        onQuery={setQuery}
        view={view}
        label={label}
        labels={labels}
        extras={extras}
        onChoose={(next, nextLabel) => {
          setView(next);
          if (nextLabel !== undefined) setLabel(nextLabel);
        }}
      />
      {view === 'trash' && !empty ? (
        <Text variant="caption" color="textSecondary">
          {`Deleted notes are removed for good after ${TRASH_DAYS} days. Open one to restore it.`}
        </Text>
      ) : null}
      {view !== 'notes' ? null : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'center',
            width: '100%',
            maxWidth: 600,
            paddingLeft: theme.space[4],
            paddingRight: theme.space[2],
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.borderStrong,
          }}
        >
          <Pressable
            role="button"
            accessibilityLabel="Take a note"
            onPress={() => setEditing({ note: null })}
            style={{ flex: 1, paddingVertical: theme.space[3] }}
          >
            <Text color="textSecondary">Take a note…</Text>
          </Pressable>
          <IconButton
            icon={ListChecks}
            accessibilityLabel="New checklist"
            onPress={() => setEditing({ note: null, checklist: true })}
          />
        </View>
      )}
      {empty ? (
        <EmptyState
          icon={
            view === 'archive'
              ? Archive
              : view === 'trash'
                ? Trash2
                : view === 'reminders'
                  ? Bell
                  : StickyNote
          }
          title={emptyText.title}
          body={emptyText.body}
        />
      ) : null}
      {shown.pinned.length ? (
        <View style={{ gap: theme.space[2] }}>
          <Text variant="eyebrow" color="textTertiary" uppercase>
            Pinned
          </Text>
          <NoteGrid notes={shown.pinned} onOpen={open} />
        </View>
      ) : null}
      {shown.others.length ? (
        <View style={{ gap: theme.space[2] }}>
          {shown.pinned.length ? (
            <Text variant="eyebrow" color="textTertiary" uppercase>
              Others
            </Text>
          ) : null}
          <NoteGrid notes={shown.others} onOpen={open} readOnly={view === 'trash'} />
        </View>
      ) : null}
      {trashed ? <TrashedNoteSheet note={trashed} onClose={() => setTrashed(null)} /> : null}
      {editing ? (
        <NoteEditor
          key={editing.note?.id ?? 'new'}
          note={editing.note}
          checklist={editing.checklist}
          label={label}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  );
}
