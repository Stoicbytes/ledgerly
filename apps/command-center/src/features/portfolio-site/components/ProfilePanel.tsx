import { useState } from 'react';
import { Image, View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Pencil } from '@/components/icons';
import { ConfirmSheet } from '@/components/overlays';
import { Button, Card, Text } from '@/components/ui';
import { mediaUrl } from '@/lib/data/storageRepository';
import type { Media } from '@/lib/domain/site';
import { useTheme } from '@/theme';
import { siteErrorMessage } from '../state/siteErrors';
import { useSiteStore } from '../state/siteStore';
import { ItemSheet } from './ItemSheet';

/** Name, headline and site settings, with "take the site offline". */
export function ProfilePanel() {
  const theme = useTheme();
  const toast = useToast();
  const { profile, mode, publication, unpublish } = useSiteStore();
  const [editing, setEditing] = useState(false);
  const [offline, setOffline] = useState(false);
  const avatar = profile?.avatar as Media | null | undefined;
  const text = (key: string) =>
    typeof profile?.[key] === 'string' ? (profile[key] as string) : '';
  const lines = [
    ['Site address', text('handle') || 'Not set'],
    ['Public site', text('site_url') || 'This site’s home page'],
    ['Location', text('location')],
    ['Contact email', text('public_email') || 'Form only'],
  ].filter(([, value]) => value);
  const takeOffline = async () => {
    try {
      await unpublish();
      toast.show({ message: 'The site is offline. Publish again to bring it back.' });
    } catch (error) {
      toast.show({ message: siteErrorMessage(error) });
    }
    setOffline(false);
  };
  return (
    <Card padding={4}>
      <View
        style={{
          flexDirection: 'row',
          gap: theme.space[4],
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {avatar ? (
          <Image
            source={{ uri: mediaUrl(avatar.small ?? avatar.path) }}
            accessibilityLabel={avatar.alt}
            style={{ width: 72, height: 72, borderRadius: theme.radius.lg }}
          />
        ) : null}
        <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
          <Text variant="h2">{text('full_name') || 'Your name'}</Text>
          <Text color="textSecondary">{text('title') || 'Add your professional title'}</Text>
          {text('headline') ? <Text variant="body">{text('headline')}</Text> : null}
        </View>
        <Button
          label={profile ? 'Edit profile' : 'Set up profile'}
          icon={Pencil}
          size="sm"
          onPress={() => setEditing(true)}
        />
      </View>
      <View style={{ marginTop: theme.space[4], gap: theme.space[2] }}>
        {lines.map(([label, value]) => (
          <View key={label} style={{ flexDirection: 'row', gap: theme.space[3] }}>
            <Text variant="caption" color="textTertiary" style={{ width: 110 }}>
              {label}
            </Text>
            <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
              {value}
            </Text>
          </View>
        ))}
      </View>
      {mode === 'cloud' && publication ? (
        <View style={{ marginTop: theme.space[4], alignItems: 'flex-start' }}>
          <Button
            label="Take the site offline"
            variant="ghost"
            size="sm"
            onPress={() => setOffline(true)}
          />
        </View>
      ) : null}
      {editing ? (
        <ItemSheet kind="profile" row={profile} onClose={() => setEditing(false)} />
      ) : null}
      <ConfirmSheet
        visible={offline}
        title="Take the site offline?"
        message="Visitors will see 'Nothing is published here yet' until you publish again. Your content stays here."
        confirmLabel="Take offline"
        destructive
        onConfirm={takeOffline}
        onCancel={() => setOffline(false)}
      />
    </Card>
  );
}
