import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/feedback';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { useAuthLinks } from '@/features/auth/useAuthLinks';
import { ThemeProvider, useTheme } from '@/theme';
import { interFonts } from '@/theme/fonts';

export { ErrorBoundary } from '@/features/shell/UpdateErrorBoundary';

export default function RootLayout() {
  useAuthLinks();
  // Fonts ship with the app (no runtime request to Google); web gets small subset WOFF2
  // files. Native waits for them to avoid unregistered-font warnings; web renders
  // immediately with the fallback font.
  const [loaded, error] = useFonts(interFonts);
  if (!loaded && !error && Platform.OS !== 'web') return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <ToastProvider>
            <ThemedStack />
          </ToastProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedStack() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}
      />
    </>
  );
}
