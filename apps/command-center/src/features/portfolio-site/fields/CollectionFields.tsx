import { useState } from 'react';
import { Image, View } from 'react-native';
import { ImagePlus, Plus, Trash2 } from '@/components/icons';
import { Button, IconButton, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { ChipField } from '@/features/investments/components/ChipField';
import { mediaUrl } from '@/lib/data/storageRepository';
import { pickImage } from '@/lib/device/media';
import type { GalleryItem, SectionItem } from '@/lib/domain/site';
import { useTheme } from '@/theme';
import { uploadImage } from '../state/siteMedia';

function Box({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        gap: theme.space[3],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {children}
    </View>
  );
}

/** Items of a "Beyond the code" section: title, a line of detail and an optional link. */
export function ItemsField({
  value,
  onChange,
  error,
}: {
  value: SectionItem[];
  onChange: (items: SectionItem[]) => void;
  error?: string;
}) {
  const theme = useTheme();
  const update = (index: number, patch: Partial<SectionItem>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="label" color="textSecondary">
        Items
      </Text>
      {value.map((item, index) => (
        <Box key={index}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="caption" color="textTertiary" style={{ flex: 1 }}>
              Item {index + 1}
            </Text>
            <IconButton
              icon={Trash2}
              accessibilityLabel={`Remove item ${index + 1}`}
              onPress={() => onChange(value.filter((_, i) => i !== index))}
            />
          </View>
          <TextField
            label="Title"
            value={item.title}
            onChangeText={(title) => update(index, { title })}
            maxLength={80}
          />
          <TextField
            label="Detail"
            value={item.detail}
            onChangeText={(detail) => update(index, { detail })}
            maxLength={300}
          />
          <TextField
            label="Link (optional)"
            value={item.url}
            onChangeText={(url) => update(index, { url })}
            maxLength={500}
            placeholder="https://…"
          />
        </Box>
      ))}
      {error ? (
        <Text variant="caption" color="danger" role="alert">
          {error}
        </Text>
      ) : null}
      {value.length < 12 ? (
        <Button
          label="Add item"
          icon={Plus}
          size="sm"
          variant="secondary"
          onPress={() => onChange([...value, { title: '', detail: '', url: '' }])}
        />
      ) : null}
    </View>
  );
}

/** Screenshots and architecture diagrams for a project page. */
export function GalleryField({
  value,
  onChange,
  error,
  canUpload,
}: {
  value: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
  error?: string;
  canUpload: boolean;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const update = (index: number, patch: Partial<GalleryItem>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const add = async () => {
    const picked = await pickImage();
    if (!picked) return;
    if ('error' in picked) return setProblem(picked.error);
    setBusy(true);
    try {
      const media = await uploadImage(picked, '');
      onChange([...value, { ...media, caption: '', kind: 'screenshot' }]);
      setProblem(null);
    } catch {
      setProblem('Upload failed. Check your connection, then try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="label" color="textSecondary">
        Screenshots and diagrams
      </Text>
      {value.map((item, index) => (
        <Box key={item.path}>
          <View style={{ flexDirection: 'row', gap: theme.space[3], alignItems: 'flex-start' }}>
            <Image
              source={{ uri: mediaUrl(item.small ?? item.path) }}
              accessibilityLabel={item.alt}
              style={{
                width: 96,
                aspectRatio: item.width / item.height,
                borderRadius: theme.radius.sm,
              }}
            />
            <View style={{ flex: 1 }} />
            <IconButton
              icon={Trash2}
              accessibilityLabel={`Remove image ${index + 1}`}
              onPress={() => onChange(value.filter((_, i) => i !== index))}
            />
          </View>
          <TextField
            label="Describe the image"
            value={item.alt}
            onChangeText={(alt) => update(index, { alt })}
            maxLength={200}
          />
          <TextField
            label="Caption"
            value={item.caption}
            onChangeText={(caption) => update(index, { caption })}
            maxLength={200}
          />
          <ChipField<GalleryItem['kind']>
            label="Shown as"
            options={[
              { value: 'screenshot', label: 'Screenshot (gallery)' },
              { value: 'diagram', label: 'Diagram (Architecture)' },
            ]}
            value={item.kind}
            onChange={(kind) => update(index, { kind })}
          />
        </Box>
      ))}
      {problem || error ? (
        <Text variant="caption" color="danger" role="alert">
          {problem ?? error}
        </Text>
      ) : !canUpload ? (
        <Text variant="caption" color="textTertiary">
          Images are uploaded when you are signed in.
        </Text>
      ) : null}
      {value.length < 12 ? (
        <Button
          label="Add image"
          icon={ImagePlus}
          size="sm"
          variant="secondary"
          loading={busy}
          disabled={!canUpload || busy}
          onPress={add}
        />
      ) : null}
    </View>
  );
}
