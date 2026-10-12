import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

// Sign-in, forgot-password and reset-password. Each screen handles an existing
// session itself (the reset screen needs the recovery session to stay here).
export default function AuthLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}
    />
  );
}
