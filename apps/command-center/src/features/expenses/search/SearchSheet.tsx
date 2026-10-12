import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Download, Search } from '@/components/icons';
import { EmptyState, useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import {
  isSearching,
  searchTotals,
  searchTransactions,
  todayIso,
  transactionsCsv,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { TextField } from '../components/TextField';
import { LedgerRow } from '../components/LedgerRow';
import { saveCsv } from '../export/saveCsv';
import { formatEntry } from '../format';
import { useLedger } from '../hooks/useLedger';
import { useSearchStore } from '../state/searchStore';
import { SearchFilterChips } from './SearchFilterChips';

/** Results shown at once; the totals and the export always cover every match. */
const SHOWN = 100;

/**
 * Find entries across every month by words (note, category, account, person), an
 * amount, type, period, category and account, with totals; export them as CSV.
 */
export function SearchSheet() {
  const theme = useTheme();
  const toast = useToast();
  const ledger = useLedger();
  const open = useSearchStore((state) => state.open);
  const hide = useSearchStore((state) => state.hide);
  const filters = useSearchStore((state) => state.filters);
  const update = useSearchStore((state) => state.update);
  const clear = useSearchStore((state) => state.clear);
  const [exporting, setExporting] = useState(false);
  const searching = isSearching(filters);
  const results = useMemo(
    () => (searching ? searchTransactions(ledger.transactions, filters, ledger) : []),
    [searching, ledger, filters],
  );
  const totals = searchTotals(results);
  const exportCsv = async () => {
    const rows = searching ? results : ledger.transactions;
    setExporting(true);
    try {
      await saveCsv(transactionsCsv(rows, ledger), `expenses-${todayIso()}.csv`);
      toast.show({ message: `Exported ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}` });
    } catch {
      toast.show({ message: 'Could not export. Try again.' });
    } finally {
      setExporting(false);
    }
  };
  return (
    <Sheet
      visible={open}
      onClose={hide}
      title="Search entries"
      description="Every month at once. A number finds that amount."
      width={720}
      footer={
        <>
          <Button label="Clear" variant="ghost" disabled={!searching} onPress={clear} />
          <View style={{ flex: 1 }} />
          <Button
            label={searching ? 'Export results' : 'Export all'}
            icon={Download}
            variant="secondary"
            loading={exporting}
            disabled={!ledger.transactions.length}
            accessibilityHint="Saves the entries as a CSV file for Excel or Sheets"
            onPress={exportCsv}
          />
        </>
      }
    >
      <View style={{ gap: theme.space[3] }}>
        <TextField
          label="Search"
          placeholder="Words or an amount, e.g. swiggy or 250"
          value={filters.text}
          onChangeText={(text) => update({ text })}
          maxLength={80}
          autoFocus
        />
        <SearchFilterChips />
        {!searching ? (
          <EmptyState
            icon={Search}
            title="Search your entries"
            body="Type a word or amount, or pick a type, period, category or account."
          />
        ) : !results.length ? (
          <EmptyState icon={Search} title="Nothing found" body="Try fewer words or filters." />
        ) : (
          <View style={{ gap: theme.space[2] }}>
            <Text variant="label" color="textSecondary" accessibilityLiveRegion="polite">
              {`${totals.count} ${totals.count === 1 ? 'entry' : 'entries'} · spent ${formatEntry(totals.expense)} · received ${formatEntry(totals.income)}`}
            </Text>
            {results.slice(0, SHOWN).map((transaction) => (
              <LedgerRow key={transaction.id} transaction={transaction} showDate />
            ))}
            {results.length > SHOWN ? (
              <Text variant="caption" color="textTertiary">
                {`Showing the newest ${SHOWN}. Narrow the search, or export to see all ${results.length}.`}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </Sheet>
  );
}
