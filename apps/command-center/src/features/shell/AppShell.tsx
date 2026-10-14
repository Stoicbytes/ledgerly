import type { Href } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { IdleWarning } from '@/features/auth/IdleWarning';
import { useIdleSignOut } from '@/features/auth/useIdleSignOut';
import { TransactionSheet } from '@/features/expenses/entry/TransactionSheet';
import { SearchSheet } from '@/features/expenses/search/SearchSheet';
import { SyncNotices } from '@/features/sync/SyncNotices';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { layout, useTheme } from '@/theme';
import { DesktopHeader } from './DesktopHeader';
import { FloatingTabBar } from './FloatingTabBar';
import { LeftRail } from './LeftRail';
import { MobileHeader } from './MobileHeader';
import { destinations } from './navigation';
import { prefetchScreens } from './prefetchScreens';

/**
 * Adaptive frame on Expo Router's headless tabs. The hidden TabList declares
 * every destination once; the visible chrome is chosen per breakpoint:
 * floating header + rail (tablet/desktop) or header + floating tab bar (phone).
 * Any touch inside counts as activity for the idle sign-out.
 */
export function AppShell() {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  const idle = useIdleSignOut();
  useEffect(prefetchScreens, []);
  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        idle.markActive();
        return false;
      }}
    >
      <Tabs style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <TabList style={{ display: 'none' }}>
          {destinations.map((item) => (
            <TabTrigger key={item.name} name={item.name} href={item.href as Href} />
          ))}
        </TabList>
        {isMobile ? (
          <View style={{ flex: 1 }}>
            <MobileHeader />
            <View style={{ paddingHorizontal: theme.space[4] }}>
              <SyncNotices />
            </View>
            <TabSlot style={{ flex: 1 }} />
            <FloatingTabBar />
          </View>
        ) : (
          <View style={{ flex: 1, padding: layout.canvasPadding, gap: layout.canvasPadding }}>
            <DesktopHeader />
            <View
              style={{ flex: 1, flexDirection: 'row', gap: layout.canvasPadding, minHeight: 0 }}
            >
              <LeftRail />
              <View style={{ flex: 1, minWidth: 0, gap: theme.space[3] }}>
                <SyncNotices />
                <TabSlot style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        )}
        <SearchSheet />
        <TransactionSheet />
      </Tabs>
      <IdleWarning
        visible={idle.phase === 'warning'}
        unsaved={idle.unsaved}
        onStay={idle.markActive}
      />
    </View>
  );
}
