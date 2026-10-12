import { useState } from 'react';
import { Image, View } from 'react-native';
import { FileText, ImagePlus } from '@/components/icons';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { mediaUrl } from '@/lib/data/storageRepository';
import { canPickPdf, pickImage, pickPdf } from '@/lib/device/media';
import type { FileRef, Media } from '@/lib/domain/site';
import { useTheme } from '@/theme';
import { uploadImage, uploadPdf } from '../state/siteMedia';

const UPLOAD_FAILED = 'Upload failed. Check your connection, then try again.';

function Label({ text, hint, error }: { text: string; hint?: string; error?: string | null }) {
  return (
    <>
      <Text variant="label" color="textSecondary">
        {text}
      </Text>
      {error ? (
        <Text variant="caption" color="danger" role="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </>
  );
}

/** Upload an image (resized on the web), see it, describe it, replace or remove it. */
export function ImageField({
  label,
  value,
  onChange,
  hint,
  error,
  wide,
  defaultAlt,
  canUpload,
}: {
  label: string;
  value: Media | null;
  onChange: (media: Media | null) => void;
  hint?: string;
  error?: string;
  wide?: boolean;
  defaultAlt: string;
  canUpload: boolean;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const choose = async () => {
    const picked = await pickImage();
    if (!picked) return;
    if ('error' in picked) return setProblem(picked.error);
    setBusy(true);
    try {
      onChange(await uploadImage(picked, value?.alt || defaultAlt));
      setProblem(null);
    } catch {
      setProblem(UPLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Label
        text={label}
        hint={canUpload ? hint : 'Images are uploaded when you are signed in.'}
        error={problem ?? error}
      />
      {value ? (
        <>
          <Image
            source={{ uri: mediaUrl(value.small ?? value.path) }}
            accessibilityLabel={value.alt}
            style={{
              width: wide ? '100%' : 120,
              aspectRatio: value.width / value.height,
              maxHeight: 260,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceMuted,
            }}
            resizeMode="cover"
          />
          <TextField
            label="Describe the image"
            value={value.alt}
            onChangeText={(alt) => onChange({ ...value, alt })}
            maxLength={200}
            hint="Read aloud by screen readers and shown if the image cannot load."
          />
        </>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        <Button
          label={value ? 'Replace' : 'Choose image'}
          icon={ImagePlus}
          size="sm"
          variant="secondary"
          loading={busy}
          disabled={!canUpload || busy}
          onPress={choose}
        />
        {value ? (
          <Button label="Remove" size="sm" variant="ghost" onPress={() => onChange(null)} />
        ) : null}
      </View>
    </View>
  );
}

/** Upload the résumé PDF (web app; phones say so). */
export function FileField({
  label,
  value,
  onChange,
  canUpload,
}: {
  label: string;
  value: FileRef | null;
  onChange: (file: FileRef | null) => void;
  canUpload: boolean;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const choose = async () => {
    const picked = await pickPdf();
    if (!picked) return;
    if ('error' in picked) return setProblem(picked.error);
    setBusy(true);
    try {
      onChange(await uploadPdf(picked));
      setProblem(null);
    } catch {
      setProblem(UPLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  };
  const hint = !canUpload
    ? 'Files are uploaded when you are signed in.'
    : !canPickPdf
      ? 'Add the PDF from the web app.'
      : 'PDF, up to 5 MB. Visitors can download it from About.';
  return (
    <View style={{ gap: 8 }}>
      <Label text={label} hint={hint} error={problem} />
      {value ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <FileText size={16} color={theme.colors.textSecondary} />
          <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
            {value.name} · {Math.max(1, Math.round(value.size / 1024))} KB
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        <Button
          label={value ? 'Replace PDF' : 'Choose PDF'}
          size="sm"
          variant="secondary"
          loading={busy}
          disabled={!canUpload || !canPickPdf || busy}
          onPress={choose}
        />
        {value ? (
          <Button label="Remove" size="sm" variant="ghost" onPress={() => onChange(null)} />
        ) : null}
      </View>
    </View>
  );
}
