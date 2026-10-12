import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Mail, Trash2 } from '@/components/icons';
import { ConfirmSheet } from '@/components/overlays';
import { Badge, Button, Card, IconButton, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { siteErrorMessage } from '../state/siteErrors';
import { useSiteStore } from '../state/siteStore';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Messages from the contact form (newest first): read, reply by email, delete. */
export function MessagesPanel() {
  const theme = useTheme();
  const toast = useToast();
  const { messages, markMessage, remove } = useSiteStore();
  const [deleting, setDeleting] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.show({ message: siteErrorMessage(error) });
    }
  };
  if (!messages.length) {
    return (
      <Card padding={4}>
        <Text color="textTertiary">
          No messages yet. Messages sent from your site&apos;s contact form appear here (no email is
          sent).
        </Text>
      </Card>
    );
  }
  return (
    <View style={{ gap: theme.space[3] }}>
      {messages.map((message) => (
        <Card key={message.id} padding={4}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[2],
              flexWrap: 'wrap',
            }}
          >
            <Text variant="bodyStrong">{message.name}</Text>
            {!message.readAt ? <Badge label="New" tone="accent" /> : null}
            <Text variant="caption" color="textTertiary" style={{ flex: 1, textAlign: 'right' }}>
              {when(message.createdAt)}
            </Text>
          </View>
          <Text variant="caption" color="textSecondary" selectable>
            {message.email}
          </Text>
          <Text variant="body" style={{ marginTop: theme.space[3] }} selectable>
            {message.message}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.space[2],
              marginTop: theme.space[3],
              flexWrap: 'wrap',
            }}
          >
            <Button
              label="Reply by email"
              icon={Mail}
              size="sm"
              variant="secondary"
              onPress={() => {
                void run(() => markMessage(message.id, true));
                void Linking.openURL(
                  `mailto:${message.email}?subject=${encodeURIComponent('Re: your message')}`,
                );
              }}
            />
            <Button
              label={message.readAt ? 'Mark as new' : 'Mark as read'}
              size="sm"
              variant="ghost"
              onPress={() => run(() => markMessage(message.id, !message.readAt))}
            />
            <View style={{ flex: 1 }} />
            <IconButton
              icon={Trash2}
              accessibilityLabel={`Delete the message from ${message.name}`}
              onPress={() => setDeleting(message.id)}
            />
          </View>
        </Card>
      ))}
      <ConfirmSheet
        visible={deleting !== null}
        title="Delete this message?"
        message="It is removed for good."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          const id = deleting;
          setDeleting(null);
          if (id) void run(() => remove('message', id));
        }}
        onCancel={() => setDeleting(null)}
      />
    </View>
  );
}
