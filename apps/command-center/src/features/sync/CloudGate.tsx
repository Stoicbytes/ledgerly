import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { lastRequestFailure } from '@/lib/data/rpc';
import { useTheme } from '@/theme';
import { startCloudSync } from './cloudSync';
import { isOnline, LOAD_MESSAGES, loadProblem } from './loadError';
import { useSyncStatus } from './syncStatus';

/** Holds the dashboard until the signed-in user's data has loaded. */
export function CloudGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const status = useSyncStatus((state) => state.status);
  // Re-renders the message when the connection comes or goes.
  const [, setChanges] = useState(0);
  const failed = status === 'loadFailed';
  useEffect(() => {
    if (!failed || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onOffline = () => setChanges((count) => count + 1);
    // Back online: load again by itself.
    const onOnline = () => {
      setChanges((count) => count + 1);
      void startCloudSync();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [failed]);
  if (status === 'loading' || failed) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space[3],
          padding: theme.space[4],
        }}
      >
        {status === 'loading' ? (
          <>
            <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel="Loading" />
            <Text color="textSecondary">Loading your data…</Text>
          </>
        ) : (
          <>
            <Text role="alert" color="textSecondary" style={{ textAlign: 'center' }}>
              {LOAD_MESSAGES[loadProblem(isOnline(), lastRequestFailure())]}
            </Text>
            <Button label="Try again" onPress={() => void startCloudSync()} />
          </>
        )}
      </View>
    );
  }
  return <>{children}</>;
}
