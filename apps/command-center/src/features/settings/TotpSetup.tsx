import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { FormMessage } from '@/features/auth/AuthCard';
import { cleanCode, isSixDigits } from '@/features/auth/oneTimeCode';
import { TextField } from '@/features/expenses/components/TextField';
import {
  removeFactor,
  startTotpEnrollment,
  verifyTotp,
  type Enrollment,
} from '@/lib/data/mfaRepository';
import { useTheme } from '@/theme';
import { QrCode } from './QrCode';

/** Groups the secret in fours so it can be typed into an app by hand. */
export const groupSecret = (secret: string) => secret.replace(/(.{4})(?=.)/g, '$1 ');

/**
 * Turning on two-step sign-in: scan the QR code (or type the key), then enter the
 * first code to prove the app is set up. Cancelling removes the unfinished factor.
 */
export function TotpSetup({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const theme = useTheme();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void startTotpEnrollment().then((result) => {
      if (!active) return;
      if (result.ok) setEnrollment(result.enrollment);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, []);

  const verify = async () => {
    if (!enrollment) return;
    const digits = cleanCode(code);
    if (!isSixDigits(digits)) {
      setError('Enter the 6-digit code your app shows for this account.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await verifyTotp(enrollment.factorId, digits);
    setBusy(false);
    if (result.ok) onDone();
    else {
      setCode('');
      setError(result.message);
    }
  };

  const cancel = async () => {
    if (enrollment) await removeFactor(enrollment.factorId);
    onCancel();
  };

  if (!enrollment) {
    return error ? (
      <View style={{ gap: theme.space[3] }}>
        <FormMessage tone="error">{error}</FormMessage>
        <Button label="Close" variant="secondary" onPress={onCancel} />
      </View>
    ) : (
      <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel="Preparing" />
    );
  }

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text color="textSecondary">
        1. In an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), add
        an account and scan this code.
      </Text>
      <QrCode svg={enrollment.qrSvg} />
      <View style={{ gap: 2 }}>
        <Text variant="caption" color="textTertiary">
          Can&apos;t scan? Enter this key instead:
        </Text>
        <Text variant="label" numeric selectable accessibilityLabel="Setup key">
          {groupSecret(enrollment.secret)}
        </Text>
      </View>
      <Text color="textSecondary">2. Enter the 6-digit code the app now shows.</Text>
      <TextField
        label="6-digit code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={7}
        onSubmitEditing={verify}
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        <Button label="Turn on" loading={busy} onPress={verify} />
        <Button label="Cancel" variant="secondary" disabled={busy} onPress={cancel} />
      </View>
    </View>
  );
}
