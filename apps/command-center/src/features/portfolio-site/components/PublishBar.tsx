import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useToast } from '@/components/feedback';
import { ExternalLink, Eye, Rocket } from '@/components/icons';
import { ConfirmSheet } from '@/components/overlays';
import { Badge, Button, Card, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { siteErrorMessage } from '../state/siteErrors';
import { useSiteStore } from '../state/siteStore';

const when = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

/**
 * Opens a URL that is only known after a request: on the web the tab is opened at once
 * (inside the click, so it is not blocked) and pointed at the link when it arrives.
 */
async function openAfter(load: () => Promise<string>): Promise<void> {
  if (Platform.OS !== 'web') return Linking.openURL(await load());
  const tab = window.open('', '_blank');
  try {
    const url = await load();
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else window.location.assign(url);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** Live status of the public site, with Preview and Publish. */
export function PublishBar() {
  const theme = useTheme();
  const toast = useToast();
  const { mode, publication, profile, publish, previewToken } = useSiteStore();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // The portfolio is this site's home page unless another address is set in Profile.
  const ownSite = Platform.OS === 'web' ? window.location.origin : '';
  const siteUrl =
    (typeof profile?.site_url === 'string' ? profile.site_url.replace(/\/+$/, '') : '') || ownSite;
  const cloud = mode === 'cloud';

  const preview = async () => {
    if (!siteUrl) return toast.show({ message: 'Add the public site URL in Profile first.' });
    try {
      await openAfter(async () => `${siteUrl}/preview#t=${await previewToken()}`);
    } catch (error) {
      toast.show({ message: siteErrorMessage(error) });
    }
  };
  const confirmPublish = async () => {
    setBusy(true);
    try {
      await publish();
      setConfirming(false);
      toast.show({ message: 'Published. The site updates within about a minute.' });
    } catch (error) {
      setConfirming(false);
      toast.show({ message: siteErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const status = !cloud
    ? 'Sample content: sign in to edit and publish your own.'
    : publication
      ? `Live · version ${publication.version} · published ${when(publication.publishedAt)}`
      : 'Not published yet: visitors see nothing.';
  return (
    <Card padding={4}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: theme.space[3],
        }}
      >
        <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[2],
              flexWrap: 'wrap',
            }}
          >
            <Text variant="bodyStrong">Public site</Text>
            {publication?.dirty ? <Badge label="Changes not published" tone="warning" /> : null}
            {publication && !publication.dirty ? <Badge label="Up to date" tone="success" /> : null}
          </View>
          <Text variant="caption" color="textSecondary">
            {status}
          </Text>
        </View>
        {siteUrl && publication ? (
          <Button
            label="Open site"
            icon={ExternalLink}
            size="sm"
            variant="ghost"
            onPress={() => void Linking.openURL(siteUrl)}
          />
        ) : null}
        <Button
          label="Preview"
          icon={Eye}
          size="sm"
          variant="secondary"
          disabled={!cloud}
          onPress={preview}
        />
        <Button
          label="Publish"
          icon={Rocket}
          size="sm"
          disabled={!cloud}
          onPress={() => setConfirming(true)}
        />
      </View>
      <ConfirmSheet
        visible={confirming}
        title="Publish your portfolio?"
        message="Everything shown (not drafts) goes live at your site address. Check it in Preview first if you have not."
        confirmLabel="Publish"
        busy={busy}
        onConfirm={confirmPublish}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}
