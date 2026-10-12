import { useState } from 'react';
import { View } from 'react-native';
import type { Note } from '@/lib/domain/notes';
import { useTheme } from '@/theme';
import { NoteCard } from './NoteCard';

/** Rough height of a card, used to balance the masonry columns. */
function weight(note: Note): number {
  const text = note.items
    ? note.items.slice(0, 6).length * 24
    : Math.min(note.body.length, 600) / 2;
  return 60 + (note.title ? 24 : 0) + text + (note.labels.length ? 26 : 0);
}

// Two columns until the width is measured (and on phones), up to five on wide screens.
const columnsFor = (width: number) => (width < 560 ? 2 : width < 860 ? 3 : width < 1180 ? 4 : 5);

/**
 * Keep-style masonry: cards flow into columns, each card added to the shortest column
 * so far. Reading order (and screen reader order) stays newest first, column by column.
 */
export function NoteGrid({
  notes,
  onOpen,
  readOnly = false,
}: {
  notes: Note[];
  onOpen: (note: Note) => void;
  /** Checklist boxes cannot be ticked (Recently deleted). */
  readOnly?: boolean;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const count = columnsFor(width);
  const columns: Note[][] = Array.from({ length: count }, () => []);
  const heights = new Array(count).fill(0);
  for (const note of notes) {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].push(note);
    heights[shortest] += weight(note);
  }
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[3] }}
    >
      {columns.map((column, index) => (
        <View key={index} style={{ flex: 1, minWidth: 0, gap: theme.space[3] }}>
          {column.map((note) => (
            <NoteCard key={note.id} note={note} onOpen={() => onOpen(note)} readOnly={readOnly} />
          ))}
        </View>
      ))}
    </View>
  );
}
