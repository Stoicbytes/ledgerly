import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { signOut } from '@/lib/data/authRepository';
import { verifySignInCode } from '@/lib/data/mfaRepository';
import { safeRedirect } from '@/lib/security/redirects';
import { useTheme } from '@/theme';
import { AuthCard, FormMessage } from './AuthCard';
import { cleanCode, isSixDigits } from './oneTimeCode';
import { useSession } from './sessionStore';

/**
 * Second step of sign-in when two-step sign-in is on: the 6-digit code from the
 * authenticator app. Supabase checks it and upgrades the session (aal2).
 */
export function VerifyCodeScreen() {
  const theme = useTheme();
  const status = useSession((state) => state.status);
  const { redirect, then } = useLocalSearchParams<{ redirect?: string; then?: string }>();
  // A password-reset link of an account with two-step sign-in comes back to the reset form.
  const target = then === 'reset' ? '/reset-password' : safeRedirect(redirect);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    return (
      <AuthCard title="Checking your session…">
        <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel="Loading" />
      </AuthCard>
    );
  }
  if (status === 'signedIn') return <Redirect href={target as '/dashboard'} />;
  if (status !== 'needsCode') return <Redirect href="/sign-in" />;

  const submit = async () => {
    const digits = cleanCode(code);
    if (!isSixDigits(digits)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await verifySignInCode(digits);
    // On success the session changes to signed in and this screen redirects.
    if (!result.ok) {
      setBusy(false);
      setCode('');
      setError(result.message);
    }
  };

  const cancel = async () => {
    await signOut();
    useSession.getState().setSignedOut();
  };

  return (
    <AuthCard
      title="Enter your code"
      description="Open your authenticator app and enter the 6-digit code for this account."
    >
      <TextField
        label="6-digit code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={7}
        autoFocus
        onSubmitEditing={submit}
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button label="Verify" loading={busy} fullWidth onPress={submit} />
      <Pressable role="button" onPress={cancel} style={{ alignSelf: 'center' }}>
        <Text variant="label" color="textSecondary" style={{ textDecorationLine: 'underline' }}>
          Use a different account
        </Text>
      </Pressable>
    </AuthCard>
  );
}
