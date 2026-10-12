import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { Bell } from '@/components/icons';
import { Button, Card, CardHeader, Text } from '@/components/ui';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { parseIsoDate, todayIso } from '@/lib/domain/expenses';
import { dueNotes, type Note } from '@/lib/domain/notes';
import { useTheme } from '@/theme';

const SHOWN = 5;
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

const summary = (note: Note) =>
  note.title || note.body.split('\n')[0] || note.items?.[0]?.text || 'Untitled note';

/** Notes whose reminder day has come; nothing at all when none is due. */
export function RemindersCard() {
  const theme = useTheme();
  const { notes, extras, patchNote } = useNotesStore();
  const today = todayIso();
  const due = extras ? dueNotes(notes, today) : [];
  if (!due.length) return null;
  return (
    <Card style={{ gap: theme.space[2] }}>
      <CardHeader
        title="Reminders due"
        subtitle={`${due.length} ${due.length === 1 ? 'note' : 'notes'} from Notes`}
        action={
          <Button
            label="Open Notes"
            variant="secondary"
            size="sm"
            onPress={() => router.push('/dashboard/notes' as Href)}
          />
        }
      />
      {due.slice(0, SHOWN).map((note) => (
        <View
          key={note.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}
        >
          <Bell size={16} color={theme.colors.textSecondary} aria-hidden />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" numberOfLines={1}>
              {summary(note)}
            </Text>
            <Text variant="caption" color={note.remindOn! < today ? 'danger' : 'textSecondary'}>
              {note.remindOn === today
                ? 'Today'
                : `Since ${day.format(parseIsoDate(note.remindOn!))}`}
            </Text>
          </View>
          <Button
            label="Done"
            variant="ghost"
            size="sm"
            accessibilityLabel={`Done: ${summary(note)}`}
            onPress={() => patchNote(note.id, { remindOn: null })}
          />
        </View>
      ))}
      {due.length > SHOWN ? (
        <Text variant="caption" color="textSecondary">
          {`and ${due.length - SHOWN} more in Notes → Reminders`}
        </Text>
      ) : null}
    </Card>
  );
}
