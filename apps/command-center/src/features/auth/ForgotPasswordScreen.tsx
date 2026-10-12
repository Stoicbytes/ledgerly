import { Link } from 'expo-router';
import { useState } from 'react';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { requestPasswordReset } from '@/lib/data/authRepository';
import { AuthCard, FormMessage } from './AuthCard';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage({ tone: 'error', text: 'Enter the email you sign in with.' });
      return;
    }
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    setMessage(
      result.ok
        ? {
            tone: 'info',
            // Same reply whether or not the account exists.
            text: 'If an account exists for that email, we have sent a link to reset the password. Open it on this device.',
          }
        : { tone: 'error', text: result.message },
    );
  };

  return (
    <AuthCard
      title="Reset your password"
      description="We will email you a link to choose a new one."
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        textContentType="emailAddress"
        maxLength={254}
        autoFocus
        onSubmitEditing={submit}
      />
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <Button label="Send reset link" loading={busy} fullWidth onPress={submit} />
      <Link href="/sign-in" style={{ alignSelf: 'center' }}>
        <Text variant="label" color="textSecondary" style={{ textDecorationLine: 'underline' }}>
          Back to sign in
        </Text>
      </Link>
    </AuthCard>
  );
}
