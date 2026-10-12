import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { updatePassword } from '@/lib/data/authRepository';
import { useTheme } from '@/theme';
import { AuthCard, FormMessage } from './AuthCard';
import { MIN_PASSWORD_LENGTH, newPasswordError } from './passwordRules';
import { useSession } from './sessionStore';

/**
 * Landing page of the reset email. Supabase exchanges the link's one-time code for a
 * short recovery session (PKCE, so only the browser that asked can use it); then the
 * user sets a new password.
 */
export function ResetPasswordScreen() {
  const theme = useTheme();
  const { status, recovery } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    return (
      <AuthCard title="Checking your link…">
        <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel="Loading" />
      </AuthCard>
    );
  }
  if (status === 'needsCode' && recovery) {
    return <Redirect href={{ pathname: '/verify-code', params: { then: 'reset' } }} />;
  }
  if (status !== 'signedIn' || !recovery) {
    return (
      <AuthCard
        title="Link not valid"
        description="Reset links work once, expire after a while, and must be opened in the browser where you asked for them."
      >
        <Link href="/forgot-password" style={{ alignSelf: 'center' }}>
          <Text variant="label" style={{ textDecorationLine: 'underline' }}>
            Request a new link
          </Text>
        </Link>
      </AuthCard>
    );
  }

  const submit = async () => {
    const problem = newPasswordError(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.ok) {
      useSession.getState().setRecovery(false);
      router.replace('/dashboard');
    } else setError(result.message);
  };

  return (
    <AuthCard title="Choose a new password">
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        maxLength={200}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters. A passphrase works well.`}
        autoFocus
      />
      <TextField
        label="Repeat new password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        maxLength={200}
        onSubmitEditing={submit}
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button label="Save password" loading={busy} fullWidth onPress={submit} />
    </AuthCard>
  );
}
