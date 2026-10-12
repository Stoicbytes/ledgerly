import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/feedback';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { ThemeProvider, useTheme } from '@/theme';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  // Fonts ship inside the bundle (no runtime request to Google). Native waits for
  // them to avoid unregistered-font warnings; web renders immediately with fallback.
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
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
