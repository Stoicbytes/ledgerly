import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Archive, ArchiveRestore, Bell, ListChecks, Pin, PinOff, Trash2 } from '@/components/icons';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, IconButton } from '@/components/ui';
import {
  allLabels,
  checklistToggleProblem,
  clampNote,
  isEmptyNote,
  NOTE_LIMITS,
  toggleChecklist,
  type Note,
} from '@/lib/domain/notes';
import { addDays, todayIso } from '@/lib/domain/expenses';
import { newId } from '@/lib/ids';
import { fontFamily, useTheme } from '@/theme';
import { useNotesStore, type NoteDraft } from '../state/notesStore';
import { ChecklistEditor } from './ChecklistEditor';
import { useNoteStyle } from './noteStyle';
import { ColorPicker, LabelEditor } from './NoteOptions';
import { ReminderField } from './ReminderField';

type NoteEditorProps = {
  /** null = a new note. */
  note: Note | null;
  /** New notes only: start as a checklist. */
  checklist?: boolean;
  /** Label to put on a new note (the label being viewed). */
  label?: string | null;
  onClose: () => void;
};

const blank = (checklist: boolean, label: string | null | undefined): NoteDraft => ({
  title: '',
  body: '',
  items: checklist ? [] : null,
  color: 'default',
  pinned: false,
  labels: label ? [label] : [],
  remindOn: null,
});

/**
 * Edit a note, Keep style: title, text or checklist, colour, labels, pin, archive and
 * delete. Closing saves; a new note left empty is discarded, and a note emptied out is
 * deleted (with Undo).
 */
export function NoteEditor({ note, checklist = false, label, onClose }: NoteEditorProps) {
  const theme = useTheme();
  const toast = useToast();
  const store = useNotesStore();
  const [draft, setDraft] = useState<NoteDraft>(note ?? blank(checklist, label));
  const [deleted] = useState(() => (store.extras ? 'Moved to Recently deleted' : 'Note deleted'));
  const style = useNoteStyle(draft.color);
  const known = allLabels(store.notes);
  const change = (patch: Partial<NoteDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const close = () => {
    if (note && isEmptyNote(clampNote(draft))) return remove('Empty note deleted');
    store.saveNote(draft, note?.id);
    onClose();
  };
  const toggleList = () => {
    const problem = checklistToggleProblem(draft);
    if (problem) toast.show({ message: problem });
    else setDraft((current) => toggleChecklist(current, newId));
  };
  const archive = () => {
    if (!note) return;
    store.saveNote(draft, note.id);
    store.patchNote(note.id, { archived: !note.archived });
    onClose();
    toast.show({
      message: note.archived ? 'Note restored' : 'Note archived',
      action: {
        label: 'Undo',
        onPress: () => store.patchNote(note.id, { archived: note.archived, pinned: draft.pinned }),
      },
    });
  };
  function remove(message = deleted) {
    if (!note) return onClose();
    const removed = store.deleteNote(note.id);
    onClose();
    if (removed) {
      toast.show({
        message,
        action: { label: 'Undo', onPress: () => store.restoreNote(removed) },
      });
    }
  }
  const input = {
    color: theme.colors.textPrimary,
    outlineWidth: 0,
    paddingVertical: 4,
  } as const;
  return (
    <Sheet
      visible
      onClose={close}
      title={note ? 'Edit note' : 'New note'}
      width={600}
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1] }}>
          <IconButton
            icon={draft.pinned ? PinOff : Pin}
            accessibilityLabel={draft.pinned ? 'Unpin note' : 'Pin note'}
            selected={draft.pinned}
            onPress={() => change({ pinned: !draft.pinned })}
          />
          <IconButton
            icon={ListChecks}
            accessibilityLabel={draft.items ? 'Show as text' : 'Show as checklist'}
            selected={!!draft.items}
            onPress={toggleList}
          />
          {store.extras ? (
            <IconButton
              icon={Bell}
              accessibilityLabel={draft.remindOn ? 'Remove reminder' : 'Add reminder'}
              selected={!!draft.remindOn}
              onPress={() => change({ remindOn: draft.remindOn ? null : addDays(todayIso(), 1) })}
            />
          ) : null}
          {note ? (
            <IconButton
              icon={note.archived ? ArchiveRestore : Archive}
              accessibilityLabel={note.archived ? 'Unarchive note' : 'Archive note'}
              onPress={archive}
            />
          ) : null}
          <IconButton icon={Trash2} accessibilityLabel="Delete note" onPress={() => remove()} />
          <View style={{ flex: 1 }} />
          <Button label="Done" onPress={close} />
        </View>
      }
    >
      <View
        style={{
          gap: theme.space[3],
          padding: theme.space[3],
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: style.border,
          backgroundColor: style.background,
        }}
      >
        <TextInput
          value={draft.title}
          onChangeText={(title) => change({ title })}
          placeholder="Title"
          placeholderTextColor={theme.colors.textSecondary}
          maxLength={NOTE_LIMITS.title}
          accessibilityLabel="Title"
          style={{ ...input, fontFamily: fontFamily.semibold, fontSize: 17 }}
        />
        {draft.items ? (
          <ChecklistEditor items={draft.items} onChange={(items) => change({ items })} />
        ) : (
          <TextInput
            value={draft.body}
            onChangeText={(body) => change({ body })}
            placeholder="Take a note…"
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            autoFocus={!note}
            maxLength={NOTE_LIMITS.body}
            accessibilityLabel="Note"
            style={{
              ...input,
              minHeight: 120,
              fontFamily: fontFamily.regular,
              fontSize: 14,
              textAlignVertical: 'top',
            }}
          />
        )}
        {draft.remindOn ? (
          <ReminderField value={draft.remindOn} onChange={(remindOn) => change({ remindOn })} />
        ) : null}
        <LabelEditor
          labels={draft.labels}
          known={known}
          onChange={(labels) => change({ labels })}
        />
      </View>
      <View style={{ marginTop: theme.space[3] }}>
        <ColorPicker value={draft.color} onChange={(color) => change({ color })} />
      </View>
    </Sheet>
  );
}
