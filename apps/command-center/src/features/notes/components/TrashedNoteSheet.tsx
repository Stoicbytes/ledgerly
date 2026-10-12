import { useState } from 'react';
import { View } from 'react-native';
import { RotateCcw, Trash2 } from '@/components/icons';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import { trashDaysLeft, type Note } from '@/lib/domain/notes';
import { useTheme } from '@/theme';
import { useNotesStore } from '../state/notesStore';

/** A deleted note: read it, put it back, or delete it for good. */
export function TrashedNoteSheet({ note, onClose }: { note: Note; onClose: () => void }) {
  const theme = useTheme();
  const toast = useToast();
  const { untrashNote, eraseNotes } = useNotesStore();
  const [days] = useState(() => trashDaysLeft(note, Date.now()));
  const restore = () => {
    untrashNote(note.id);
    onClose();
    toast.show({ message: 'Note restored' });
  };
  const erase = () => {
    eraseNotes([note.id]);
    onClose();
    toast.show({ message: 'Note deleted for good' });
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Deleted note"
      description={
        days > 0
          ? `Deleted for good in ${days} ${days === 1 ? 'day' : 'days'} unless you restore it.`
          : 'Deleted for good the next time the app loads, unless you restore it.'
      }
      width={560}
      footer={
        <>
          <Button label="Delete for good" icon={Trash2} variant="danger" onPress={erase} />
          <View style={{ flex: 1 }} />
          <Button label="Restore" icon={RotateCcw} onPress={restore} />
        </>
      }
    >
      <View style={{ gap: theme.space[2] }}>
        {note.title ? <Text variant="bodyStrong">{note.title}</Text> : null}
        {note.items ? (
          note.items.map((item) => (
            <Text key={item.id} color={item.done ? 'textSecondary' : 'textPrimary'}>
              {`${item.done ? '☑' : '☐'} ${item.text}`}
            </Text>
          ))
        ) : (
          <Text>{note.body || 'Empty note'}</Text>
        )}
      </View>
    </Sheet>
  );
}
