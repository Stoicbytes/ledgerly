import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme, type Breakpoint } from '@/theme';

type ResponsiveGridProps = {
  children: ReactNode;
  /** Columns per breakpoint; a breakpoint without a value inherits from the one below. */
  columns?: Partial<Record<Breakpoint, number>>;
};

const order: Breakpoint[] = ['sm', 'md', 'lg', 'xl'];

export function columnsFor(
  breakpoint: Breakpoint,
  columns: Partial<Record<Breakpoint, number>>,
): number {
  let resolved = 1;
  for (const key of order) {
    resolved = columns[key] ?? resolved;
    if (key === breakpoint) break;
  }
  return Math.max(1, Math.floor(resolved));
}

/**
 * Grid whose column count is chosen per breakpoint (layouts are designed, not shrunk).
 * Rows of equal flex cells: the count comes from the window width, so the first render
 * already has its final layout (no full-width frame before the grid measures itself).
 */
export function ResponsiveGrid({
  children,
  columns = { sm: 1, md: 2, lg: 3 },
}: ResponsiveGridProps) {
  const theme = useTheme();
  const { breakpoint } = useBreakpoint();
  const count = columnsFor(breakpoint, columns);
  const gap = theme.space[4];
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let index = 0; index < items.length; index += count) {
    rows.push(items.slice(index, index + count));
  }
  return (
    <View style={{ gap }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap }}>
          {Array.from({ length: count }, (_, index) => (
            <View key={index} style={{ flex: 1, minWidth: 0 }}>
              {row[index] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
