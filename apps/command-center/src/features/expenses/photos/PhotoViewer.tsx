import { Image } from 'react-native';
import { Text } from '@/components/ui';
import { Sheet } from '@/components/overlays';
import type { Photo } from '@/lib/domain/expenses';
import { useReceiptUri } from './receipts';

/** Full-size receipt photo (a stored one through a link that expires after a minute). */
export function PhotoViewer({
  photo,
  visible,
  onClose,
}: {
  photo: Photo | null;
  visible: boolean;
  onClose: () => void;
}) {
  const shown = useReceiptUri(visible ? photo : null);
  return (
    <Sheet visible={visible && !!photo} onClose={onClose} title="Receipt photo" width={640}>
      {photo && shown.failed ? (
        <Text color="textSecondary">The photo could not be loaded. Check the connection.</Text>
      ) : photo && shown.uri ? (
        <Image
          source={{ uri: shown.uri }}
          accessibilityLabel="Receipt photo"
          resizeMode="contain"
          style={{
            width: '100%',
            aspectRatio: photo.width && photo.height ? photo.width / photo.height : 3 / 4,
            maxHeight: 640,
          }}
        />
      ) : null}
    </Sheet>
  );
}
