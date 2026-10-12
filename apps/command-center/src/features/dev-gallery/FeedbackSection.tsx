import { Inbox } from '@/components/icons';
import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState, ErrorState, useToast } from '@/components/feedback';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { Section } from '@/components/layout/Section';
import { ConfirmSheet, Sheet } from '@/components/overlays';
import { Button, Card, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export function FeedbackSection() {
  const theme = useTheme();
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <Section
      title="Feedback & overlays"
      description="Sheets become dialogs on wide screens; destructive actions confirm and offer undo."
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        <Button label="Open sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
        <Button label="Confirm delete" variant="secondary" onPress={() => setConfirmOpen(true)} />
        <Button
          label="Toast"
          variant="secondary"
          onPress={() => toast.show({ message: 'Saved' })}
        />
        <Button
          label="Toast with undo"
          variant="secondary"
          onPress={() =>
            toast.show({
              message: 'Transaction deleted',
              action: { label: 'Undo', onPress: () => toast.show({ message: 'Restored' }) },
            })
          }
        />
      </View>
      <ResponsiveGrid columns={{ sm: 1, md: 2 }}>
        <Card>
          <EmptyState
            icon={Inbox}
            title="No transactions this month"
            body="Add your first expense to see where your money goes."
            action={{
              label: 'Add expense',
              onPress: () => toast.show({ message: 'Sample action' }),
            }}
          />
        </Card>
        <Card>
          <ErrorState onRetry={() => toast.show({ message: 'Retried (sample)' })} />
        </Card>
      </ResponsiveGrid>
      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Sample sheet"
        description="Bottom sheet on phones, dialog on larger screens."
        footer={<Button label="Done" onPress={() => setSheetOpen(false)} />}
      >
        <Text color="textSecondary">
          Press Escape (web), the back button (Android) or the scrim to close.
        </Text>
      </Sheet>
      <ConfirmSheet
        visible={confirmOpen}
        title="Delete this transaction?"
        message="It will be removed from your balances and reports. You can undo for a few seconds."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast.show({
            message: 'Deleted (sample)',
            action: { label: 'Undo', onPress: () => undefined },
          });
        }}
      />
    </Section>
  );
}
