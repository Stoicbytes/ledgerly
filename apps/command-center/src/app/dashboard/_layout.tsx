import { Redirect, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/sessionStore';
import { AppShell } from '@/features/shell/AppShell';
import { CloudGate } from '@/features/sync/CloudGate';
import { useTheme } from '@/theme';

// Requires a session when Supabase is configured; without a project the app runs as a
// labelled preview. This guard is convenience only: Row Level Security is what keeps
// data private.
export default function DashboardLayout() {
  const theme = useTheme();
  const status = useSession((state) => state.status);
  const pathname = usePathname();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel="Loading" />
      </View>
    );
  }
  if (status === 'signedOut') {
    return <Redirect href={{ pathname: '/sign-in', params: { redirect: pathname } }} />;
  }
  if (status === 'needsCode') {
    return <Redirect href={{ pathname: '/verify-code', params: { redirect: pathname } }} />;
  }
  return (
    <CloudGate>
      <AppShell />
    </CloudGate>
  );
}
