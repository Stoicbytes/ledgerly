import type { Note } from '@/lib/domain/notes';
import { useTheme } from '@/theme';
import { noteColors } from '@/theme/noteColors';

/** Background, border and text roles for a note's colour in the current theme. */
export function useNoteStyle(color: Note['color']) {
  const theme = useTheme();
  const plain = color === 'default';
  return {
    background: plain ? theme.colors.surface : noteColors[theme.scheme][color],
    border: plain ? theme.colors.border : 'transparent',
    // Small text on coloured notes uses the primary text colour for full contrast.
    muted: plain ? ('textSecondary' as const) : ('textPrimary' as const),
  };
}
