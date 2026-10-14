import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { useSession } from '@/features/auth/sessionStore';
import { useTheme } from '@/theme';
import { samples } from './samples';
import { showSamples } from './showSamples';

/** In preview mode, holds the dashboard until the sample data has loaded. */
export function PreviewGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const preview = useSession((state) => state.status === 'preview');
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(() =>
    samples() ? 'ready' : 'loading',
  );
  useEffect(() => {
    if (!preview || state !== 'loading') return undefined;
    let active = true;
    showSamples().then(
      () => active && setState('ready'),
      () => active && setState('failed'),
    );
    return () => {
      active = false;
    };
  }, [preview, state]);
  if (!preview || state === 'ready') return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space[3] }}>
      {state === 'loading' ? (
        <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel="Loading" />
      ) : (
        <>
          <Text role="alert" color="textSecondary">
            The sample data could not be loaded.
          </Text>
          <Button label="Try again" onPress={() => setState('loading')} />
        </>
      )}
    </View>
  );
}
