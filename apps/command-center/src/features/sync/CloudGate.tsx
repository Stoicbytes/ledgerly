import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { startCloudSync } from './cloudSync';
import { useSyncStatus } from './syncStatus';

/** Holds the dashboard until the signed-in user's data has loaded. */
export function CloudGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const status = useSyncStatus((state) => state.status);
  if (status === 'loading' || status === 'loadFailed') {
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
              Your data could not be loaded. Check your connection and try again.
            </Text>
            <Button label="Try again" onPress={() => void startCloudSync()} />
          </>
        )}
      </View>
    );
  }
  return <>{children}</>;
}
