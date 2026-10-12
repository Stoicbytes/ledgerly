import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { layout, useTheme } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  /**
   * Desktop only: the page fills the viewport without page scrolling; panels
   * scroll internally. Tablet and phone always scroll (stacked layout).
   */
  fit?: boolean;
};

/** Fit (no page scroll) only on desktop windows tall enough to show everything. */
export function useFitMode(fit: boolean) {
  const { mode, density } = useBreakpoint();
  return fit && mode === 'desktop' && density !== 'short';
}

/** Page canvas inside the app shell. */
export function Screen({ children, fit = false }: ScreenProps) {
  const theme = useTheme();
  const { mode } = useBreakpoint();
  const fitActive = useFitMode(fit);
  const inner: ViewStyle = {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    gap: theme.space[4],
    paddingHorizontal: mode === 'mobile' ? theme.space[4] : 0,
    paddingRight: mode === 'mobile' ? theme.space[4] : layout.canvasPadding,
    paddingTop: mode === 'mobile' ? theme.space[3] : 0,
    paddingBottom:
      mode === 'mobile' ? layout.bottomBarHeight + theme.space[10] : layout.canvasPadding,
  };
  if (fitActive) {
    return <View style={[inner, { flex: 1, minHeight: 0 }]}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
