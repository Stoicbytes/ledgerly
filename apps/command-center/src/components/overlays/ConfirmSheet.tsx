import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { Sheet } from './Sheet';

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Replaces window.confirm: works on every platform and states the consequence. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={title}
      width={440}
      footer={
        <>
          <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} />
          <Button
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
            loading={busy}
          />
        </>
      }
    >
      <Text color="textSecondary">{message}</Text>
    </Sheet>
  );
}
