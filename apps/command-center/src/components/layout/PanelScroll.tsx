import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useFitMode } from '@/components/layout/Screen';

/**
 * List area inside a card. On fit (no page scroll) layouts it scrolls on its
 * own; elsewhere the page scrolls, so it is a plain stack.
 */
export function PanelScroll({ children, gap = 2 }: { children: ReactNode; gap?: number }) {
  const fit = useFitMode(true);
  if (!fit) return <View style={{ gap }}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, minHeight: 0, marginHorizontal: -4 }}
      contentContainerStyle={{ gap, paddingHorizontal: 4 }}
    >
      {children}
    </ScrollView>
  );
}
