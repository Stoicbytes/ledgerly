import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import { flushCloudSync } from '@/features/sync/cloudSync';
import { signOut } from '@/lib/data/authRepository';
import { useSession } from './sessionStore';

/** Shown in the last two minutes before an idle sign-out. */
export function IdleWarning({ visible, onStay }: { visible: boolean; onStay: () => void }) {
  const leave = async () => {
    await flushCloudSync();
    await signOut();
    useSession.getState().setSignedOut();
  };
  return (
    <Sheet
      visible={visible}
      onClose={onStay}
      title="Still there?"
      width={440}
      footer={
        <>
          <Button label="Sign out now" variant="secondary" onPress={leave} />
          <Button label="Stay signed in" onPress={onStay} />
        </>
      }
    >
      <Text color="textSecondary">
        To keep your finances private, you will be signed out in under 2 minutes unless you carry
        on.
      </Text>
    </Sheet>
  );
}
