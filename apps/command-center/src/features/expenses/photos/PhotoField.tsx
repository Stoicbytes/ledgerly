import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Camera, ImagePlus, X } from '@/components/icons';
import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { FieldRow } from '../entry/FieldRow';
import { useTransactionForm } from '../state/transactionForm';
import { pickPhoto } from './pickPhoto';
import { PhotoViewer } from './PhotoViewer';
import { storeReceipt, useReceiptUri } from './receipts';

/**
 * "Photo" line of the entry form: take or upload a receipt, see it, or remove it. Signed
 * in, the photo is uploaded privately as soon as it is picked; saving waits for it.
 */
export function PhotoField() {
  const theme = useTheme();
  const photo = useTransactionForm((state) => state.draft.photo);
  const update = useTransactionForm((state) => state.update);
  const uploading = useTransactionForm((state) => state.uploading);
  const shown = useReceiptUri(photo);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const choose = async (source: 'camera' | 'library') => {
    const result = await pickPhoto(source);
    if (!result) return;
    if ('error' in result) return setError(result.error);
    setError(null);
    const form = useTransactionForm.getState();
    const opened = form.opened;
    form.setUploading(true);
    try {
      const stored = await storeReceipt(result.photo);
      if (useTransactionForm.getState().opened === opened) update({ photo: stored });
    } catch {
      if (useTransactionForm.getState().opened === opened) {
        setError('Could not upload the photo. Check the connection and try again.');
      }
    } finally {
      if (useTransactionForm.getState().opened === opened) form.setUploading(false);
    }
  };
  return (
    <>
      <FieldRow label="Photo" active={false} error={error ?? undefined}>
        {photo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
            <Pressable
              role="button"
              accessibilityLabel="View the receipt photo"
              onPress={() => setViewing(true)}
            >
              {shown.uri ? (
                <Image
                  source={{ uri: shown.uri }}
                  style={{ width: 44, height: 44, borderRadius: theme.radius.sm }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radius.sm,
                    backgroundColor: theme.colors.surfaceMuted,
                  }}
                />
              )}
            </Pressable>
            <Text variant="caption" color="textTertiary" style={{ flex: 1 }} numberOfLines={1}>
              {photo.path
                ? shown.failed
                  ? 'Saved privately · could not be shown now'
                  : 'Saved privately'
                : 'Not uploaded in the preview'}
            </Text>
            <Pressable
              role="button"
              accessibilityLabel="Remove the photo"
              hitSlop={8}
              onPress={() => update({ photo: null })}
            >
              <X size={16} color={theme.colors.textTertiary} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: theme.space[2], paddingVertical: 4 }}>
            <Button
              label="Take photo"
              icon={Camera}
              size="sm"
              variant="secondary"
              disabled={uploading}
              onPress={() => choose('camera')}
            />
            <Button
              label={uploading ? 'Uploading…' : 'Upload'}
              icon={ImagePlus}
              size="sm"
              variant="secondary"
              loading={uploading}
              onPress={() => choose('library')}
            />
          </View>
        )}
      </FieldRow>
      <PhotoViewer photo={photo} visible={viewing} onClose={() => setViewing(false)} />
    </>
  );
}
