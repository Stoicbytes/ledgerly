import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Bell, Pin, Square, SquareCheck } from '@/components/icons';
import { Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { parseIsoDate, todayIso } from '@/lib/domain/expenses';
import { checklistProgress, type Note } from '@/lib/domain/notes';
import { useTheme } from '@/theme';
import { useNotesStore } from '../state/notesStore';
import { useNoteStyle } from './noteStyle';

const PREVIEW_ITEMS = 6;
const reminderDay = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

/** "Reminder · 12 Oct", in the warning colour once the day has come. */
function ReminderChip({ date, muted }: { date: string; muted: 'textPrimary' | 'textSecondary' }) {
  const theme = useTheme();
  const due = date <= todayIso();
  const tone = due ? 'danger' : muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Bell size={12} color={theme.colors[tone]} aria-hidden />
      <Text variant="caption" color={tone}>
        {`${due ? 'Due' : 'Reminder'} · ${reminderDay.format(parseIsoDate(date))}`}
      </Text>
    </View>
  );
}

/** One note in the grid: title, text or checklist preview, labels. Press to edit. */
export function NoteCard({
  note,
  onOpen,
  readOnly = false,
}: {
  note: Note;
  onOpen: () => void;
  readOnly?: boolean;
}) {
  const theme = useTheme();
  const style = useNoteStyle(note.color);
  const toggleItem = useNotesStore((state) => state.toggleItem);
  const progress = checklistProgress(note);
  const items = note.items ? [...note.items].sort((a, b) => Number(a.done) - Number(b.done)) : [];
  const summary = note.title || note.body.split('\n')[0] || note.items?.[0]?.text || 'Empty note';
  const reminder = note.remindOn
    ? `, reminder ${reminderDay.format(parseIsoDate(note.remindOn))}`
    : '';
  const openLabel = `Open ${note.pinned ? 'pinned note' : 'note'}: ${summary}${reminder}`;
  return (
    <View
      style={{
        gap: theme.space[2],
        padding: theme.space[3],
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: style.border,
        backgroundColor: style.background,
      }}
    >
      <NoteOpener label={openLabel} onOpen={onOpen}>
        {note.title || note.pinned ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[2] }}>
            <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={3}>
              {note.title}
            </Text>
            {note.pinned ? <Pin size={14} color={theme.colors.textPrimary} aria-hidden /> : null}
          </View>
        ) : null}
        {!note.items && note.body ? (
          <Text variant="label" numberOfLines={10}>
            {note.body}
          </Text>
        ) : null}
        {!note.items && !note.title && !note.body ? (
          <Text variant="label" color={style.muted}>
            Empty note
          </Text>
        ) : null}
        {note.items && !note.title && !note.pinned ? (
          <Text variant="caption" color={style.muted}>
            Checklist
          </Text>
        ) : null}
      </NoteOpener>
      {note.items ? (
        <View style={{ gap: 4 }}>
          {items.slice(0, PREVIEW_ITEMS).map((item) => {
            const Box = item.done ? SquareCheck : Square;
            return (
              <Pressable
                key={item.id}
                role="checkbox"
                accessibilityState={{ checked: item.done }}
                accessibilityLabel={item.text || 'Empty item'}
                disabled={readOnly}
                onPress={() => toggleItem(note.id, item.id)}
                hitSlop={4}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}
              >
                <Box size={15} color={theme.colors.textPrimary} />
                <Text
                  variant="label"
                  color={item.done ? style.muted : 'textPrimary'}
                  numberOfLines={2}
                  style={{ flex: 1, textDecorationLine: item.done ? 'line-through' : 'none' }}
                >
                  {item.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {progress || note.labels.length || note.remindOn ? (
        <NoteOpener label={openLabel} onOpen={onOpen} secondary>
          {note.remindOn ? <ReminderChip date={note.remindOn} muted={style.muted} /> : null}
          {progress ? (
            <Text variant="caption" color={style.muted}>
              {`${progress.done}/${progress.total} done${items.length > PREVIEW_ITEMS ? ` · ${items.length - PREVIEW_ITEMS} more` : ''}`}
            </Text>
          ) : null}
          {note.labels.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {note.labels.map((label) => (
                <View
                  key={label}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: theme.radius.pill,
                    borderWidth: 1,
                    borderColor: theme.colors.borderStrong,
                  }}
                >
                  <Text variant="caption" color={style.muted}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </NoteOpener>
      ) : null}
    </View>
  );
}

/** The part of a card that opens the note (title, text, footer); checkboxes stay separate. */
function NoteOpener({
  label,
  onOpen,
  secondary = false,
  children,
}: {
  label: string;
  onOpen: () => void;
  /** A second press target (footer) for touch and mouse; hidden from assistive tech. */
  secondary?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { focused, handlers } = useInteractionState();
  return (
    <Pressable
      role={secondary ? undefined : 'button'}
      accessibilityLabel={secondary ? undefined : label}
      aria-hidden={secondary || undefined}
      tabIndex={secondary ? -1 : undefined}
      onPress={onOpen}
      {...handlers}
      style={[
        { gap: theme.space[2] },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      {children}
    </Pressable>
  );
}
