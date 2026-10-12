import { ScrollView, View } from 'react-native';
import { Check, Trash2 } from '@/components/icons';
import { Sheet } from '@/components/overlays';
import { Button, IconButton, Text } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { useTransactionForm } from '../state/transactionForm';
import { EntryForm } from './EntryForm';
import { EntryPanel } from './EntryPanel';
import { kindLabel, useEntryActions, type SavedNotice } from './useEntryActions';

/** Fixed body height on wide screens; the picker column scrolls inside it. */
const BODY_HEIGHT = 452;

/**
 * Add / edit transaction, opened from the expense pages' Add buttons, the
 * Overview's quick actions and any transaction row. A dialog with the
 * fields beside the active picker on wide screens; a bottom sheet on phones.
 */
export function TransactionSheet() {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  const open = useTransactionForm((state) => state.open);
  const editingId = useTransactionForm((state) => state.editingId);
  const kind = useTransactionForm((state) => state.draft.kind);
  const close = useTransactionForm((state) => state.close);
  const uploading = useTransactionForm((state) => state.uploading);
  const { save, remove, notice, clearNotice } = useEntryActions();
  const dismiss = () => {
    clearNotice();
    close();
  };
  return (
    <Sheet
      visible={open}
      onClose={dismiss}
      title={editingId ? `Edit ${kindLabel[kind].toLowerCase()}` : 'Add transaction'}
      width={900}
      footer={
        <>
          {editingId ? (
            <IconButton
              icon={Trash2}
              tone="danger"
              variant="muted"
              tooltip="top"
              accessibilityLabel="Delete this entry"
              onPress={remove}
            />
          ) : null}
          <View style={{ flex: 1 }} />
          {editingId ? null : (
            <Button
              label="Continue"
              variant="secondary"
              accessibilityHint="Saves this entry and starts the next one"
              disabled={uploading}
              onPress={() => save('continue')}
            />
          )}
          <Button label="Save" loading={uploading} onPress={() => save('save')} />
        </>
      }
    >
      {notice ? <SavedBanner notice={notice} /> : null}
      {isMobile ? (
        // Phones: each picker opens right under its field (InlinePanel in the form).
        <EntryForm onSubmit={() => save('save')} />
      ) : (
        <View style={{ flexDirection: 'row', gap: theme.space[5], height: BODY_HEIGHT }}>
          <View style={{ flex: 1 }}>
            <EntryForm onSubmit={() => save('save')} />
          </View>
          <View
            style={{
              flex: 1.2,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
            }}
          >
            <ScrollView contentContainerStyle={{ padding: theme.space[4] }}>
              <EntryPanel columns={4} />
            </ScrollView>
          </View>
        </View>
      )}
    </Sheet>
  );
}

function SavedBanner({ notice }: { notice: SavedNotice }) {
  const theme = useTheme();
  return (
    <View
      role="status"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        paddingLeft: theme.space[3],
        paddingRight: theme.space[1],
        paddingVertical: theme.space[1],
        marginBottom: theme.space[3],
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.successSoft,
      }}
    >
      <Check size={16} color={theme.colors.success} strokeWidth={2.4} />
      <Text variant="label" color="success" style={{ flex: 1 }} numberOfLines={1}>
        {notice.message}
      </Text>
      <Button label="Undo" variant="ghost" size="sm" onPress={notice.undo} />
    </View>
  );
}
