import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { LogOut, Smartphone } from '@/components/icons';
import { ConfirmSheet } from '@/components/overlays';
import { Badge, Button, Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import { FormMessage } from '@/features/auth/AuthCard';
import {
  listTotpFactors,
  removeFactor,
  signOutOtherDevices,
  type TotpFactor,
} from '@/lib/data/mfaRepository';
import { useTheme } from '@/theme';
import { TotpSetup } from './TotpSetup';

type Notice = { tone: 'error' | 'info'; text: string } | null;

/** Two-step sign-in, signing out other devices, and the idle sign-out rule. */
export function SecurityCard({ index }: { index: number }) {
  const theme = useTheme();
  const [factors, setFactors] = useState<TotpFactor[] | null | undefined>(undefined);
  const [setting, setSetting] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((value) => value + 1);
  useEffect(() => {
    let active = true;
    void listTotpFactors().then((result) => {
      if (active) setFactors(result);
    });
    return () => {
      active = false;
    };
  }, [version]);

  const enrolled = factors?.find((factor) => factor.verified);

  const turnOff = async () => {
    if (!enrolled) return;
    setBusy(true);
    const result = await removeFactor(enrolled.id);
    setBusy(false);
    setConfirmOff(false);
    setNotice(
      result.ok
        ? { tone: 'info', text: 'Two-step sign-in is off.' }
        : { tone: 'error', text: result.message },
    );
    load();
  };

  const signOutOthers = async () => {
    setBusy(true);
    const result = await signOutOtherDevices();
    setBusy(false);
    setNotice(
      result.ok
        ? {
            tone: 'info',
            text: 'Other browsers and phones are signed out. This one stays signed in.',
          }
        : { tone: 'error', text: result.message },
    );
  };

  return (
    <Card index={index} style={{ gap: theme.space[3] }}>
      <CardHeader
        title="Two-step sign-in"
        subtitle="A 6-digit code from an authenticator app after your password"
        action={<CategoryIcon icon={Smartphone} tint={5} size={40} />}
      />
      {factors === undefined ? (
        <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel="Loading" />
      ) : factors === null ? (
        <FormMessage tone="error">
          Could not check two-step sign-in. Reload to try again.
        </FormMessage>
      ) : setting ? (
        <TotpSetup
          onDone={() => {
            setSetting(false);
            setNotice({
              tone: 'info',
              text: 'Two-step sign-in is on. Other devices were signed out.',
            });
            load();
          }}
          onCancel={() => {
            setSetting(false);
            load();
          }}
        />
      ) : (
        <View style={{ gap: theme.space[2] }}>
          <Badge label={enrolled ? 'On' : 'Off'} tone={enrolled ? 'success' : 'warning'} />
          <Text color="textSecondary">
            {enrolled
              ? 'Signing in asks for your password and then a code from your app.'
              : 'Only your password protects this account. Turn this on so a stolen password is not enough.'}
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            {enrolled ? (
              <Button label="Turn off" variant="secondary" onPress={() => setConfirmOff(true)} />
            ) : (
              <Button
                label="Set up"
                onPress={() => {
                  setNotice(null);
                  setSetting(true);
                }}
              />
            )}
          </View>
        </View>
      )}
      {notice ? <FormMessage tone={notice.tone}>{notice.text}</FormMessage> : null}
      <View style={{ gap: theme.space[2], paddingTop: theme.space[2] }}>
        <Text variant="bodyStrong">Other devices</Text>
        <Text color="textSecondary">
          Signed in somewhere you no longer use? End every other session; this one stays signed in.
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label="Sign out other devices"
            icon={LogOut}
            variant="secondary"
            loading={busy && !confirmOff}
            onPress={signOutOthers}
          />
        </View>
      </View>
      <ConfirmSheet
        visible={confirmOff}
        title="Turn off two-step sign-in?"
        message="Your password alone will open this account again. You can turn it back on at any time."
        confirmLabel="Turn off"
        destructive
        busy={busy}
        onConfirm={turnOff}
        onCancel={() => setConfirmOff(false)}
      />
    </Card>
  );
}
