import { Pressable, View } from 'react-native';
import { HandCoins, Pencil, Trash2 } from '@/components/icons';
import { Badge, Button, Money, Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { dayLabel, type OpenSplit, type PersonBalance } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { formatEntry } from '../format';
import { useLookup } from '../hooks/useLedger';
import { useTransactionForm } from '../state/transactionForm';

type PersonDetailProps = {
  balance: PersonBalance;
  onSettle: () => void;
  /** Mark one shared expense as paid. */
  onSettleOne: (split: OpenSplit, title: string) => void;
  onRename: () => void;
  onDelete: () => void;
};

/** One person: what they owe, each shared expense and its status, and their repayments. */
export function PersonDetail({
  balance,
  onSettle,
  onSettleOne,
  onRename,
  onDelete,
}: PersonDetailProps) {
  const theme = useTheme();
  const lookup = useLookup();
  const openEdit = useTransactionForm((state) => state.openEdit);
  const { person, outstanding, lent, repaid } = balance;
  const shareTitle = (split: OpenSplit) =>
    split.transaction.note || lookup.path(split.transaction.categoryId) || 'Expense';
  return (
    <View style={{ gap: theme.space[4] }}>
      <View style={{ gap: theme.space[1] }}>
        <Text variant="label" color="textSecondary">
          {outstanding >= 0 ? `${person.name} owes you` : `You owe ${person.name}`}
        </Text>
        <Money
          value={Math.abs(outstanding)}
          variant="figure"
          tone={outstanding > 0 ? 'income' : 'neutral'}
        />
        <Text variant="caption" color="textTertiary">
          {`Shared ${formatEntry(lent)} · paid back ${formatEntry(repaid)}`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        <Button
          label="Record payment"
          icon={HandCoins}
          disabled={outstanding <= 0}
          onPress={onSettle}
        />
        <Button label="Rename" icon={Pencil} variant="secondary" onPress={onRename} />
        <Button label="Delete" icon={Trash2} variant="ghost" onPress={onDelete} />
      </View>
      <Text variant="eyebrow" color="textTertiary" uppercase>
        {`Shared expenses · ${balance.splits.length}`}
      </Text>
      {balance.splits.length ? (
        balance.splits.map((split) => (
          <ShareRow
            key={split.transaction.id}
            split={split}
            title={shareTitle(split)}
            onOpen={() => openEdit(split.transaction)}
            onSettle={() => onSettleOne(split, shareTitle(split))}
          />
        ))
      ) : (
        <Text color="textSecondary">
          Nothing shared yet. Use Split when adding an expense you paid for them.
        </Text>
      )}
      {balance.repayments.length ? (
        <>
          <Text variant="eyebrow" color="textTertiary" uppercase>
            {`Paid back · ${balance.repayments.length}`}
          </Text>
          {balance.repayments.map((repayment) => (
            <Pressable
              key={repayment.id}
              role="button"
              accessibilityLabel={`Repayment ${formatEntry(repayment.amount)} on ${dayLabel(repayment.date)}, edit`}
              onPress={() => openEdit(repayment)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[3],
                paddingVertical: 6,
              }}
            >
              <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                {`${dayLabel(repayment.date, 'short')} · ${lookup.account(repayment.accountId)?.name ?? 'Account'}`}
              </Text>
              <Text variant="label" color="income" numeric>
                {formatEntry(repayment.amount, 'always')}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </View>
  );
}

function ShareRow({
  split,
  title,
  onOpen,
  onSettle,
}: {
  split: OpenSplit;
  title: string;
  onOpen: () => void;
  onSettle: () => void;
}) {
  const theme = useTheme();
  const { hovered, handlers } = useInteractionState();
  const settled = split.remaining === 0;
  const part = !settled && split.paid > 0;
  const status = settled ? 'paid' : part ? `${formatEntry(split.remaining)} left` : 'unpaid';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        padding: theme.space[2],
        borderRadius: theme.radius.md,
        backgroundColor: hovered ? theme.colors.surfaceMuted : 'transparent',
      }}
    >
      <Pressable
        role="button"
        accessibilityLabel={`${title}, ${dayLabel(split.transaction.date)}, their share ${formatEntry(split.amount)}, ${status}. Edit the expense`}
        onPress={onOpen}
        {...handlers}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="textTertiary" numberOfLines={1}>
          {`${dayLabel(split.transaction.date, 'short')} · bill ${formatEntry(split.transaction.amount)}${part ? ` · ${formatEntry(split.paid)} paid` : ''}`}
        </Text>
      </Pressable>
      <View style={{ alignItems: 'flex-end' }}>
        {/* Paid money is struck out: all of it once settled, the paid part while partly paid. */}
        <Text
          variant={settled ? 'label' : part ? 'caption' : 'label'}
          color={settled || part ? 'textTertiary' : 'textPrimary'}
          numeric
          style={{ textDecorationLine: settled || part ? 'line-through' : 'none' }}
        >
          {formatEntry(split.amount)}
        </Text>
        {part ? (
          <Text variant="label" numeric>
            {formatEntry(split.remaining)}
          </Text>
        ) : null}
      </View>
      {settled ? (
        <Badge label="Paid" tone="success" />
      ) : (
        <Button
          label="Mark paid"
          size="sm"
          variant="secondary"
          accessibilityLabel={`Mark ${title} paid, ${formatEntry(split.remaining)}`}
          onPress={onSettle}
        />
      )}
    </View>
  );
}
