import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { ResponsiveGrid } from './ResponsiveGrid';

type StatStripProps = {
  /** The highlighted (gradient) tile. */
  hero: ReactNode;
  /** Remaining KPI tiles. */
  children: ReactNode;
  /** Row height on desktop. */
  height?: number;
};

/** KPI strip: one row on desktop; hero above a 4/2-column grid on tablet/phone. */
export function StatStrip({ hero, children, height }: StatStripProps) {
  const theme = useTheme();
  const { mode, isDense } = useBreakpoint();
  // Shorter strip on short laptop screens so the panels below keep their rows.
  const rowHeight = height ?? (isDense ? 92 : 124);
  if (mode === 'desktop') {
    return (
      <View style={{ flexDirection: 'row', gap: theme.space[4], height: rowHeight }}>
        <View style={{ flex: 1.5 }}>{hero}</View>
        {Children.toArray(children).map((child, index) => (
          <View key={index} style={{ flex: 1, minWidth: 0 }}>
            {child}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ gap: theme.space[4] }}>
      {hero}
      <ResponsiveGrid columns={{ sm: 2, md: 4 }}>{children}</ResponsiveGrid>
    </View>
  );
}
