import { Children, useState, type ReactNode } from 'react';
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

/** Wrapping grid whose column count is chosen per breakpoint (layouts are designed, not shrunk). */
export function ResponsiveGrid({
  children,
  columns = { sm: 1, md: 2, lg: 3 },
}: ResponsiveGridProps) {
  const theme = useTheme();
  const { breakpoint } = useBreakpoint();
  const [width, setWidth] = useState(0);
  const count = columnsFor(breakpoint, columns);
  const gap = theme.space[4];
  const itemWidth = width > 0 ? (width - gap * (count - 1)) / count : undefined;
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={itemWidth ? { width: itemWidth } : { width: '100%' }}>
          {child}
        </View>
      ))}
    </View>
  );
}
