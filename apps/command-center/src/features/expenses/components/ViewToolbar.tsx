import { useMemo } from 'react';
import { View } from 'react-native';
import { Chip, ScrollRow, SegmentedControl, type Segment } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { sortAccounts } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { useLedger } from '../hooks/useLedger';
import { useExpenseUi, type ExpenseView } from '../state/expenseUi';

const views: readonly Segment<ExpenseView>[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'monthly', label: 'Monthly' },
];

/** The chosen view; the calendar until another is chosen, on every screen size. */
export function useActiveView(): ExpenseView {
  return useExpenseUi((state) => state.view) ?? 'calendar';
}

/** Daily · Calendar · Monthly switch and the account filter. */
export function ViewToolbar() {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  const view = useActiveView();
  const setView = useExpenseUi((state) => state.setView);
  return (
    <View
      style={{
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: theme.space[3],
      }}
    >
      <SegmentedControl
        segments={views}
        value={view}
        onChange={setView}
        accessibilityLabel="Transactions view"
        fill={isMobile}
        size="sm"
      />
      <AccountFilter />
    </View>
  );
}

/** Single-choice account chips; "All accounts" clears the filter. */
export function AccountFilter() {
  const { isMobile } = useBreakpoint();
  const { accounts } = useLedger();
  const accountId = useExpenseUi((state) => state.accountId);
  const setAccount = useExpenseUi((state) => state.setAccount);
  const ordered = useMemo(() => sortAccounts(accounts), [accounts]);
  return (
    <ScrollRow accessibilityLabel="Filter by account" align={isMobile ? 'start' : 'end'}>
      <Chip label="All accounts" selected={!accountId} onPress={() => setAccount(null)} />
      {ordered.map((account) => (
        <Chip
          key={account.id}
          label={account.name}
          selected={accountId === account.id}
          onPress={() => setAccount(accountId === account.id ? null : account.id)}
        />
      ))}
    </ScrollRow>
  );
}
