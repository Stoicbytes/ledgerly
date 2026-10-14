import { View } from 'react-native';
import { Inbox, RotateCcw } from '@/components/icons';
import { Button, Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import { canPickFiles } from '@/features/investments/import/pickFiles';
import { ACCOUNT_TYPE_LABELS, parseIsoDate } from '@/lib/domain/expenses';
import type { SheetImportPlan } from '@/lib/domain/expenses/sheetImports';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { useSheetImport, type ImportSave } from './useSheetImport';

const date = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    parseIsoDate(iso),
  );
const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

/** What the import would add, in plain lines, before anything is saved. */
export function reviewLines(plan: SheetImportPlan): string[] {
  const lines: string[] = [];
  if (plan.range) {
    lines.push(
      `${count(plan.transactions.length, 'entry', 'entries')} from ${date(plan.range.start)} to ${date(plan.range.end)}: ${money(plan.expense)} spent, ${money(plan.income)} income.`,
    );
  }
  if (plan.transfers) {
    lines.push(
      `${count(plan.transfers, 'transfer')} between accounts (not counted as spending or income).`,
    );
  }
  if (plan.corrections.length) {
    const parts = plan.corrections.map((item) => `${item.account} ${money(item.amount)}`);
    lines.push(`Opening balances from balance corrections: ${parts.join(', ')}.`);
  }
  if (plan.accounts.length) {
    const names = plan.accounts.map((a) => `${a.name} (${ACCOUNT_TYPE_LABELS[a.group]})`);
    lines.push(`New accounts: ${names.join(', ')}.`);
  }
  const top = plan.categories.filter((item) => item.parentId === null);
  if (plan.categories.length) {
    lines.push(
      `${count(top.length, 'new category', 'new categories')} and ${count(plan.categories.length - top.length, 'subcategory', 'subcategories')}; the rest match yours.`,
    );
  }
  if (plan.remaining) {
    lines.push(
      `${count(plan.remaining, 'more entry', 'more entries')} after these: import the same file again once this import is saved.`,
    );
  }
  if (plan.duplicates) {
    lines.push(`${count(plan.duplicates, 'entry', 'entries')} already in Ledgerly, skipped.`);
  }
  const reasons = new Map<string, number>();
  for (const item of plan.skipped) reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1);
  for (const [reason, n] of reasons) lines.push(`${count(n, 'row')} left out. ${reason}`);
  if (!plan.transactions.length && !plan.duplicates) {
    lines.unshift('Nothing to import: the file has no expense or income rows that can be added.');
  }
  return lines;
}

/** Where the imported entries stand: saved, still on the way, or not saved. */
export function saveLine(save: ImportSave, entries: number): string {
  switch (save.state) {
    case 'preview':
      return 'Preview: nothing is saved.';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved.';
    case 'notSaved':
      return save.refused
        ? `Not saved: ${count(save.refused, 'entry', 'entries')} could not be saved and ${save.refused === 1 ? 'was' : 'were'} taken out again.`
        : `Not saved yet: ${count(entries, 'entry', 'entries')} wait on this device and are sent when the connection is back.`;
  }
}

/** Brings in entries exported from another expense app (Money Manager and similar). */
export function SheetImportCard({ index }: { index: number }) {
  const theme = useTheme();
  const { state, choose, approve, undo, reset } = useSheetImport();
  return (
    <Card index={index} style={{ gap: theme.space[4] }}>
      <CardHeader
        title="Import from another app"
        subtitle="Your old expense app's .xlsx or .csv export. Read on this device; you review first."
        action={<CategoryIcon icon={Inbox} tint={2} size={40} />}
      />
      {state.phase === 'review' ? (
        <View style={{ gap: theme.space[2] }}>
          <Text variant="bodyStrong">{state.file}</Text>
          {reviewLines(state.plan).map((line) => (
            <Text key={line} variant="caption" color="textSecondary">
              {line}
            </Text>
          ))}
          <View style={{ flexDirection: 'row', gap: theme.space[3], flexWrap: 'wrap' }}>
            {state.plan.transactions.length ? (
              <Button
                label={`Import ${count(state.plan.transactions.length, 'entry', 'entries')}`}
                onPress={() => void approve()}
              />
            ) : null}
            <Button label="Cancel" variant="secondary" onPress={reset} />
          </View>
        </View>
      ) : state.phase === 'done' ? (
        <View style={{ gap: theme.space[3] }}>
          <Text variant="caption" color="textSecondary">
            {`Imported ${count(state.imported.transactions.length, 'entry', 'entries')}. Set each new account's opening balance in Accounts so its balance matches your bank.${state.imported.remaining ? ' Import the same file again for the rest.' : ''}`}
          </Text>
          <Text
            variant="caption"
            color={state.save.state === 'notSaved' ? 'warning' : 'textSecondary'}
            accessibilityLiveRegion="polite"
          >
            {saveLine(state.save, state.imported.transactions.length)}
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.space[3], flexWrap: 'wrap' }}>
            <Button label="Done" variant="secondary" onPress={reset} />
            <Button label="Undo import" icon={RotateCcw} variant="secondary" onPress={undo} />
          </View>
        </View>
      ) : canPickFiles ? (
        <View style={{ gap: theme.space[2] }}>
          <Button
            label="Choose file"
            icon={Inbox}
            variant="secondary"
            loading={state.phase === 'reading'}
            onPress={() => void choose()}
          />
          {state.phase === 'choose' && state.problem ? (
            <Text variant="caption" color="danger">
              {state.problem}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text variant="caption" color="textSecondary">
          Importing works in the web app for now.
        </Text>
      )}
    </Card>
  );
}
