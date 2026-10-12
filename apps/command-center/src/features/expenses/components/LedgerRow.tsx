import { Pressable, View } from 'react-native';
import { Camera } from '@/components/icons';
import { CategoryIcon, Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { dayLabel, type Transaction } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { describeTransaction } from '../describe';
import { formatEntry, speakEntry } from '../format';
import { useLookup } from '../hooks/useLedger';
import { useTransactionForm } from '../state/transactionForm';

type LedgerRowProps = {
  transaction: Transaction;
  /** Account filter in effect: transfers are signed from its point of view. */
  accountId?: string | null;
  showDate?: boolean;
};

/** One entry in any list. Pressing it opens the entry in the editor. */
export function LedgerRow({ transaction, accountId, showDate = false }: LedgerRowProps) {
  const theme = useTheme();
  const lookup = useLookup();
  const openEdit = useTransactionForm((state) => state.openEdit);
  const { hovered, focused, handlers } = useInteractionState();
  const entry = describeTransaction(transaction, lookup, accountId);
  const sign = entry.signed ? 'always' : 'never';
  const caption = showDate
    ? `${dayLabel(transaction.date, 'short')} · ${entry.caption}`
    : entry.caption;
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${entry.title}, ${speakEntry(entry.amount, sign)}, ${caption.replace(' → ', ' to ')}${transaction.photo ? ', has a photo' : ''}`}
      accessibilityHint="Opens the entry to edit or delete it"
      onPress={() => openEdit(transaction)}
      {...handlers}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          paddingVertical: theme.space[2],
          paddingHorizontal: theme.space[2],
          borderRadius: theme.radius.md,
          backgroundColor: hovered ? theme.colors.surfaceMuted : 'transparent',
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <CategoryIcon
        icon={entry.icon}
        tint={typeof entry.tint === 'number' ? entry.tint : 0}
        colors={
          entry.tint === 'transfer'
            ? { bg: theme.colors.transferSoft, fg: theme.colors.transfer }
            : undefined
        }
        size={36}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {entry.title}
          </Text>
          {transaction.photo ? (
            <Camera size={13} color={theme.colors.textTertiary} aria-hidden />
          ) : null}
        </View>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <Text variant="bodyStrong" color={entry.tone} numeric numberOfLines={1}>
        {formatEntry(entry.amount, sign)}
      </Text>
    </Pressable>
  );
}
