import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { UserPlus } from '@/components/icons';
import { SegmentedControl, Text } from '@/components/ui';
import { amountToInput, evaluateAmount, parseAmount, type SplitMode } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { useLookup } from '../hooks/useLedger';
import { useExpenseStore } from '../state/expenseStore';
import { useTransactionForm } from '../state/transactionForm';
import { FieldRow } from './FieldRow';
import { NewPersonForm, PaidShare, ShareInput, SplitStatus } from './SplitParts';
import { PickChip } from './PickChip';

/** "Split" line of the entry form (expenses): who shares it and your own share. */
export function SplitRow() {
  const lookup = useLookup();
  const draft = useTransactionForm((state) => state.draft);
  const editingId = useTransactionForm((state) => state.editingId);
  const active = useTransactionForm((state) => state.active);
  const error = useTransactionForm((state) => state.errors.split);
  const setActive = useTransactionForm((state) => state.setActive);
  const open: string[] = [];
  const paid: string[] = [];
  for (const split of draft.splits) {
    const name = lookup.person(split.personId)?.name ?? 'Someone';
    const status = lookup.share(editingId, split.personId);
    (status && status.remaining === 0 ? paid : open).push(name);
  }
  const summary =
    [open.length ? `With ${open.join(', ')}` : '', paid.length ? `${paid.join(', ')} paid` : '']
      .filter(Boolean)
      .join(' · ') || 'Not split';
  return (
    <FieldRow
      label="Split"
      active={active === 'split'}
      error={error}
      onPress={() => setActive('split')}
      accessibilityLabel={`Split, ${summary}`}
    >
      <Text numberOfLines={1} color={draft.splits.length ? 'textPrimary' : 'textTertiary'}>
        {summary}
      </Text>
    </FieldRow>
  );
}

/** "From" line shown instead of the category when editing a repayment. */
export function RepaymentRow() {
  const lookup = useLookup();
  const personId = useTransactionForm((state) => state.draft.personId);
  const name = lookup.person(personId)?.name ?? 'Someone';
  return (
    <FieldRow label="From" active={false} accessibilityLabel={`Repayment from ${name}`}>
      <Text numberOfLines={1}>{`${name} paid you back`}</Text>
    </FieldRow>
  );
}

const modes = [
  { value: 'equal', label: 'Equally' },
  { value: 'others', label: 'They pay all' },
  { value: 'custom', label: 'Custom' },
] as const satisfies readonly { value: SplitMode; label: string }[];

/**
 * Picker for the Split field. Equal modes work the shares out from the amount (and
 * follow it when it changes); typing a share switches to Custom, where everyone's
 * share, yours included, must add up to the amount.
 */
export function SplitPanel() {
  const theme = useTheme();
  const lookup = useLookup();
  const people = useExpenseStore((state) => state.people);
  const draft = useTransactionForm((state) => state.draft);
  const editingId = useTransactionForm((state) => state.editingId);
  const update = useTransactionForm((state) => state.update);
  const [adding, setAdding] = useState(false);
  const amount = evaluateAmount(draft.amountText) ?? 0;
  const others = draft.splits.reduce((sum, split) => sum + (parseAmount(split.amountText) ?? 0), 0);
  const toggle = (personId: string) =>
    update({
      splits: draft.splits.some((split) => split.personId === personId)
        ? draft.splits.filter((split) => split.personId !== personId)
        : [...draft.splits, { personId, amountText: '' }],
    });
  const setShare = (personId: string, amountText: string) => {
    const splits = draft.splits.map((item) =>
      item.personId === personId ? { ...item, amountText } : item,
    );
    if (draft.splitMode === 'custom') return update({ splits });
    // Typing a share means a custom split; your share starts as what is left.
    const rest =
      amount - splits.reduce((sum, item) => sum + (parseAmount(item.amountText) ?? 0), 0);
    update({ splits, splitMode: 'custom', myShareText: amountToInput(Math.max(0, rest)) || '0' });
  };
  const chooseMode = (splitMode: SplitMode) =>
    update(
      splitMode === 'custom'
        ? { splitMode, myShareText: amountToInput(Math.max(0, amount - others)) || '0' }
        : { splitMode },
    );
  return (
    <View style={{ gap: theme.space[3] }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        {people.map((person) => (
          <PickChip
            key={person.id}
            label={person.name}
            selected={draft.splits.some((split) => split.personId === person.id)}
            onPress={() => toggle(person.id)}
            accessibilityLabel={`Split with ${person.name}`}
          />
        ))}
        <Pressable
          role="button"
          accessibilityLabel="Add a person"
          onPress={() => setAdding((value) => !value)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 }}
        >
          <UserPlus size={16} color={theme.colors.textSecondary} />
          <Text variant="label" color="textSecondary">
            Person
          </Text>
        </Pressable>
      </View>
      {adding ? (
        <NewPersonForm
          onAdded={(personId) => {
            update({ splits: [...draft.splits, { personId, amountText: '' }] });
            setAdding(false);
          }}
        />
      ) : null}
      {draft.splits.length ? (
        <>
          <SegmentedControl
            size="sm"
            segments={modes}
            value={draft.splitMode}
            onChange={chooseMode}
            accessibilityLabel="How to split"
          />
          {draft.splits.map((split) => {
            const name = lookup.person(split.personId)?.name ?? 'Someone';
            const status = lookup.share(editingId, split.personId);
            // A share already paid back is shown struck out and kept as it is.
            if (status && status.remaining === 0) {
              return <PaidShare key={split.personId} name={name} amount={status.amount} />;
            }
            return (
              <ShareInput
                key={split.personId}
                name={name}
                value={split.amountText}
                paid={status?.paid}
                onChange={(text) => setShare(split.personId, text)}
                onRemove={() => toggle(split.personId)}
              />
            );
          })}
          {draft.splitMode === 'custom' ? (
            <ShareInput
              name="You"
              value={draft.myShareText}
              onChange={(myShareText) => update({ myShareText })}
            />
          ) : null}
          <SplitStatus
            amount={amount}
            others={others}
            repaid={draft.splits.reduce(
              (sum, split) => sum + (lookup.share(editingId, split.personId)?.paid ?? 0),
              0,
            )}
            mine={draft.splitMode === 'custom' ? parseAmount(draft.myShareText) : null}
            onRestToMe={() =>
              update({ myShareText: amountToInput(Math.max(0, amount - others)) || '0' })
            }
          />
        </>
      ) : (
        <Text color="textSecondary">
          Paid for friends? Choose who shares this expense. Stats and budgets count only your share,
          and People tracks what each person owes you.
        </Text>
      )}
    </View>
  );
}
