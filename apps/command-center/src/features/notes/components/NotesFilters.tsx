import { TextInput, View } from 'react-native';
import { Search } from '@/components/icons';
import { Chip } from '@/components/ui';
import { fontFamily, useTheme } from '@/theme';

/** Which notes the screen shows: the notes (all or one label), reminders, archive or deleted. */
export type NotesView = 'notes' | 'reminders' | 'archive' | 'trash';

type NotesFiltersProps = {
  query: string;
  onQuery: (query: string) => void;
  view: NotesView;
  label: string | null;
  labels: string[];
  /** Reminders and Recently deleted exist (migration 0015 when signed in). */
  extras: boolean;
  onChoose: (view: NotesView, label?: string | null) => void;
};

/** Search box and the view chips: All notes, each label, Reminders, Archive, Recently deleted. */
export function NotesFilters({
  query,
  onQuery,
  view,
  label,
  labels,
  extras,
  onChoose,
}: NotesFiltersProps) {
  const theme = useTheme();
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          paddingHorizontal: theme.space[3],
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Search size={16} color={theme.colors.textSecondary} aria-hidden />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Search notes"
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel="Search notes"
          style={{
            flex: 1,
            paddingVertical: 9,
            color: theme.colors.textPrimary,
            fontFamily: fontFamily.regular,
            fontSize: 14,
            outlineWidth: 0,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        <Chip
          label="All notes"
          selected={view === 'notes' && !label}
          onPress={() => onChoose('notes', null)}
        />
        {labels.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={view === 'notes' && label === item}
            onPress={() => onChoose('notes', item)}
          />
        ))}
        {extras ? (
          <Chip
            label="Reminders"
            selected={view === 'reminders'}
            onPress={() => onChoose('reminders')}
          />
        ) : null}
        <Chip label="Archive" selected={view === 'archive'} onPress={() => onChoose('archive')} />
        {extras ? (
          <Chip
            label="Recently deleted"
            selected={view === 'trash'}
            onPress={() => onChoose('trash')}
          />
        ) : null}
      </View>
    </>
  );
}
