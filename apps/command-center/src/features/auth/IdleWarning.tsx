import { useState } from 'react';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import { discardUnsavedChanges, flushCloudSync } from '@/features/sync/cloudSync';
import { signOut } from '@/lib/data/authRepository';
import { useSession } from './sessionStore';

type IdleWarningProps = {
  /** The last two minutes before an idle sign-out. */
  visible: boolean;
  /** Time is up but a change is not saved yet: the sign-out waits for it. */
  unsaved: boolean;
  onStay: () => void;
};

/**
 * Shown in the last two minutes before an idle sign-out, and for as long as the sign-out
 * waits for an unsaved change. Signing out with a change unsaved asks first, as in
 * Settings.
 */
export function IdleWarning({ visible, unsaved, onStay }: IdleWarningProps) {
  const [notSent, setNotSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const waiting = unsaved || notSent;
  const end = async () => {
    await signOut();
    useSession.getState().setSignedOut();
  };
  const leave = async () => {
    setBusy(true);
    const saved = await flushCloudSync();
    setBusy(false);
    if (saved) await end();
    else setNotSent(true);
  };
  const discard = async () => {
    setBusy(true);
    discardUnsavedChanges();
    await end();
    setBusy(false);
  };
  const stay = () => {
    setNotSent(false);
    onStay();
  };
  return (
    <Sheet
      visible={visible || waiting}
      onClose={stay}
      title={waiting ? 'Some changes are not saved yet' : 'Still there?'}
      width={440}
      footer={
        <>
          {waiting ? (
            <Button
              label="Sign out anyway"
              variant="danger"
              loading={busy}
              onPress={() => void discard()}
            />
          ) : (
            <Button
              label="Sign out now"
              variant="secondary"
              loading={busy}
              onPress={() => void leave()}
            />
          )}
          <Button label="Stay signed in" onPress={stay} />
        </>
      }
    >
      <Text color="textSecondary">
        {waiting
          ? 'They could not be sent (you may be offline). You stay signed in, and are signed out once they are saved. Sign out anyway and they are lost.'
          : 'To keep your finances private, you will be signed out in under 2 minutes unless you carry on.'}
      </Text>
    </Sheet>
  );
}
