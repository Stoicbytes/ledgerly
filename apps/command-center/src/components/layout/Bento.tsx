import { createContext, useContext, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';

const StackedContext = createContext(false);

type BentoRowProps = {
  children: ReactNode;
  /** Stack into a column below this layout mode. */
  stackBelow?: 'tablet' | 'desktop';
  /** In fit mode, share the remaining height with other `fill` rows (flex weight). */
  fill?: number;
  /** Fixed row height when side by side (fit layouts). */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Horizontal bento row that becomes a vertical stack on smaller screens. */
export function BentoRow({ children, stackBelow = 'tablet', fill, height, style }: BentoRowProps) {
  const theme = useTheme();
  const { mode } = useBreakpoint();
  const stacked = stackBelow === 'desktop' ? mode !== 'desktop' : mode === 'mobile';
  return (
    <StackedContext.Provider value={stacked}>
      <View
        style={[
          stacked
            ? { gap: theme.space[4] }
            : {
                flexDirection: 'row',
                gap: theme.space[4],
                flex: fill,
                height,
                minHeight: fill ? 0 : undefined,
              },
          style,
        ]}
      >
        {children}
      </View>
    </StackedContext.Provider>
  );
}

type BentoCellProps = {
  children: ReactNode;
  flex?: number;
  style?: StyleProp<ViewStyle>;
  gap?: boolean;
};

/** A column inside a BentoRow. Children stack vertically with the standard gap. */
export function BentoCell({ children, flex = 1, style, gap = true }: BentoCellProps) {
  const theme = useTheme();
  const stacked = useContext(StackedContext);
  return (
    <View
      style={[
        stacked ? null : { flex, minWidth: 0, minHeight: 0 },
        gap && { gap: theme.space[4] },
        style,
      ]}
    >
      {children}
    </View>
  );
}
