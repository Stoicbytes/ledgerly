import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { useToast } from '@/components/feedback';
import { ConfirmSheet } from '@/components/overlays';
import { renderWithProviders } from '@/test/render';

describe('ConfirmSheet', () => {
  it('calls confirm and cancel handlers', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderWithProviders(
      <ConfirmSheet
        visible
        title="Delete?"
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hidden', async () => {
    await renderWithProviders(
      <ConfirmSheet
        visible={false}
        title="Delete?"
        message="m"
        confirmLabel="Delete"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByText('Delete?')).toBeNull();
  });
});

describe('Toast', () => {
  function Trigger({ onUndo }: { onUndo: () => void }) {
    const toast = useToast();
    return (
      <Pressable
        role="button"
        onPress={() =>
          toast.show({ message: 'Deleted', action: { label: 'Undo', onPress: onUndo } })
        }
      >
        <Text>Show</Text>
      </Pressable>
    );
  }

  it('shows a message and runs the undo action once', async () => {
    const onUndo = jest.fn();
    await renderWithProviders(<Trigger onUndo={onUndo} />);
    await fireEvent.press(screen.getByText('Show'));
    expect(screen.getByText('Deleted')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Deleted')).toBeNull();
  });
});
