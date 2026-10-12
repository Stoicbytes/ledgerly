import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { suggestNotes, type DraftField, type TransactionKind } from '@/lib/domain/expenses';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { useExpenseStore } from '../state/expenseStore';
import { useTransactionForm } from '../state/transactionForm';
import { AccountPicker } from './AccountPicker';
import { CategoryPicker } from './CategoryPicker';
import { DatePicker } from './DatePicker';
import { PickChip } from './PickChip';
import { SplitPanel } from './SplitField';

export type EntryPanelKind =
  'date' | 'category' | 'account' | 'toAccount' | 'fee' | 'split' | 'note';

/** Which picker accompanies the active field. While typing the amount it previews the next step. */
function panelFor(active: DraftField | null, kind: TransactionKind): EntryPanelKind {
  if (active === null || active === 'amount') return kind === 'transfer' ? 'account' : 'category';
  return active;
}

const titles: Record<EntryPanelKind, string> = {
  date: 'Date',
  category: 'Category',
  account: 'Account',
  toAccount: 'To account',
  fee: 'Transfer fee',
  split: 'Split with',
  note: 'Suggestions',
};

/** The picker for the active field (right column on wide screens, under the fields on phones). */
export function EntryPanel({ columns }: { columns: number }) {
  const theme = useTheme();
  const draft = useTransactionForm((state) => state.draft);
  const active = useTransactionForm((state) => state.active);
  const choose = useTransactionForm((state) => state.choose);
  const update = useTransactionForm((state) => state.update);
  const advance = useTransactionForm((state) => state.advance);
  const transactions = useExpenseStore((state) => state.transactions);
  const panel = panelFor(active, draft.kind);
  const notes = useMemo(
    () =>
      panel === 'note'
        ? suggestNotes(transactions, {
            query: draft.note,
            kind: draft.kind,
            categoryId: draft.categoryId,
          })
        : [],
    [panel, transactions, draft.note, draft.kind, draft.categoryId],
  );
  const title = panel === 'account' && draft.kind === 'transfer' ? 'From account' : titles[panel];
  return (
    <View style={{ gap: theme.space[3] }}>
      <Text variant="eyebrow" color="textSecondary" uppercase>
        {title}
      </Text>
      {panel === 'date' ? (
        <DatePicker
          value={draft.date}
          onChoose={(date) => {
            update({ date });
            advance('date');
          }}
        />
      ) : panel === 'category' && draft.kind !== 'transfer' ? (
        <CategoryPicker
          key={draft.kind}
          kind={draft.kind}
          selectedId={draft.categoryId}
          columns={columns}
          onChoose={(id) => choose('category', id)}
        />
      ) : panel === 'account' || panel === 'toAccount' ? (
        <AccountPicker
          columns={2}
          selectedId={panel === 'account' ? draft.accountId : draft.toAccountId}
          disabledId={
            draft.kind === 'transfer'
              ? panel === 'account'
                ? draft.toAccountId
                : draft.accountId
              : null
          }
          onChoose={(id) => choose(panel, id)}
        />
      ) : panel === 'split' ? (
        <SplitPanel />
      ) : panel === 'note' ? (
        notes.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
            {notes.map((suggestion) => (
              <PickChip
                key={suggestion.note}
                label={suggestion.note}
                selected={false}
                onPress={() =>
                  // A note you used before brings its usual category when none is chosen yet.
                  update(
                    !draft.categoryId && suggestion.categoryId && draft.kind !== 'transfer'
                      ? { note: suggestion.note, categoryId: suggestion.categoryId }
                      : { note: suggestion.note },
                  )
                }
              />
            ))}
          </View>
        ) : (
          <Text color="textSecondary">
            {draft.note.trim()
              ? 'No earlier note matches. It will be suggested next time.'
              : 'Start typing: notes from earlier entries are suggested here.'}
          </Text>
        )
      ) : (
        <Text color="textSecondary">
          Bank or ATM charges for this transfer. They are taken from the “from” account and counted
          as an expense (Transfer fees), while the transfer itself is not.
        </Text>
      )}
    </View>
  );
}

/**
 * Phones: the picker for the active field, shown right under that field instead of
 * at the end of the form, so choosing never means scrolling down and back.
 */
export function InlinePanel({ field }: { field: EntryPanelKind }) {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  const active = useTransactionForm((state) => state.active);
  const kind = useTransactionForm((state) => state.draft.kind);
  if (!isMobile || panelFor(active, kind) !== field) return null;
  return (
    <View style={{ paddingTop: theme.space[2], paddingBottom: theme.space[3] }}>
      <EntryPanel columns={3} />
    </View>
  );
}
