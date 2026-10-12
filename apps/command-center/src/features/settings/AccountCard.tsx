import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { LogOut, Shield } from '@/components/icons';
import { ConfirmSheet } from '@/components/overlays';
import { Badge, Button, Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import { useSession } from '@/features/auth/sessionStore';
import { flushCloudSync, hasUnsavedChanges } from '@/features/sync/cloudSync';
import { signOut } from '@/lib/data/authRepository';
import { useTheme } from '@/theme';

/** Who is signed in, and signing out of this device. */
export function AccountCard({ index }: { index: number }) {
  const theme = useTheme();
  const { status, email } = useSession();
  const [busy, setBusy] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const finish = async () => {
    setBusy(true);
    await signOut();
    useSession.getState().setSignedOut();
    setBusy(false);
    setUnsaved(false);
    router.replace('/sign-in');
  };
  const leave = async () => {
    setBusy(true);
    // Send any change still waiting before the session ends.
    await flushCloudSync();
    if (hasUnsavedChanges()) {
      // Offline or the server is busy: signing out now would lose them.
      setBusy(false);
      setUnsaved(true);
      return;
    }
    await finish();
  };
  return (
    <Card index={index} style={{ gap: theme.space[3] }}>
      <CardHeader
        title="Account & security"
        action={<CategoryIcon icon={Shield} tint={2} size={40} />}
      />
      {status === 'signedIn' ? (
        <>
          <Text color="textSecondary">
            Signed in as{' '}
            <Text variant="bodyStrong" numberOfLines={1}>
              {email ?? 'your account'}
            </Text>
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              label="Sign out"
              icon={LogOut}
              variant="secondary"
              loading={busy}
              onPress={leave}
            />
          </View>
          <ConfirmSheet
            visible={unsaved}
            title="Some changes are not saved yet"
            message="They could not be sent (you may be offline). Stay signed in and they are sent when the connection is back; sign out now and they are lost."
            confirmLabel="Sign out anyway"
            destructive
            busy={busy}
            onConfirm={() => void finish()}
            onCancel={() => setUnsaved(false)}
          />
        </>
      ) : (
        <>
          <Badge label="Preview · sign-in not configured" tone="warning" />
          <Text color="textSecondary">
            This deployment has no Supabase project, so there is no account and nothing is saved.
          </Text>
        </>
      )}
    </Card>
  );
}
