import { useMemo } from 'react';
import { OTHER_ID, type Slice } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';

/**
 * Pie colour index for each slice, as in Money Manager: colours follow rank
 * (largest slice first: coral, orange, yellow, green, cyan, blue, violet),
 * and the folded "Other" slice is grey (null).
 */
export function sliceSlots(slices: Slice[], size: number): (number | null)[] {
  let rank = 0;
  return slices.map((slice) => (slice.id === OTHER_ID ? null : rank++ % size));
}

/** Resolved colours for a list of slices (same order, largest first). */
export function useSliceColors(slices: Slice[]): string[] {
  const theme = useTheme();
  return useMemo(() => {
    const { pie, pieOther } = theme.colors;
    return sliceSlots(slices, pie.length).map((slot) => (slot === null ? pieOther : pie[slot]));
  }, [slices, theme]);
}
