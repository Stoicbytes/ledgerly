import { View } from 'react-native';
import { ReceiptText } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Text } from '@/components/ui';
import { dayLabel, monthLabel, parseIsoDate, type DayGroup } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { formatEntry, speakEntry } from '../format';
import { useMonthView } from '../hooks/useMonthView';
import { useTransactionForm } from '../state/transactionForm';
import { LedgerRow } from './LedgerRow';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { RevealMore, useReveal } from '@/components/layout/RevealMore';

const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });

/** Entries grouped by day, newest first, with each day's totals (Money Manager's Daily tab). */
export function DailyView() {
  const theme = useTheme();
  const { groups, accountId, today, month } = useMonthView();
  const openNew = useTransactionForm((state) => state.openNew);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const { limit, rest, more } = useReveal(total, `${month}:${accountId ?? ''}`);
  if (!groups.length) {
    return (
      <EmptyState
        icon={ReceiptText}
        title={`No entries in ${monthLabel(month)}`}
        body="Entries you add for this month appear here, grouped by day."
        action={{ label: 'Add an entry', onPress: () => openNew() }}
      />
    );
  }
  return (
    <PanelScroll gap={theme.space[3]}>
      {firstRows(groups, limit).map((group) => (
        <View key={group.date} style={{ gap: 2 }}>
          <DayHeader group={group} isToday={group.date === today} />
          {group.items.map((transaction) => (
            <LedgerRow key={transaction.id} transaction={transaction} accountId={accountId} />
          ))}
        </View>
      ))}
      <RevealMore rest={rest} onMore={more} />
    </PanelScroll>
  );
}

/** The days holding the first `limit` entries (the last day cut short if needed). */
export function firstRows(groups: DayGroup[], limit: number): DayGroup[] {
  const shown: DayGroup[] = [];
  let left = limit;
  for (const group of groups) {
    if (left <= 0) break;
    shown.push(
      left >= group.items.length ? group : { ...group, items: group.items.slice(0, left) },
    );
    left -= group.items.length;
  }
  return shown;
}

function DayHeader({ group, isToday }: { group: DayGroup; isToday: boolean }) {
  const theme = useTheme();
  const totals = [
    group.income ? `received ${speakEntry(group.income)}` : '',
    group.expense ? `spent ${speakEntry(group.expense)}` : '',
  ].filter(Boolean);
  return (
    <View
      role="heading"
      aria-level={3}
      accessible
      accessibilityLabel={`${dayLabel(group.date)}${isToday ? ', today' : ''}: ${totals.join(', ')}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        paddingHorizontal: theme.space[2],
        paddingVertical: theme.space[2],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text variant="title" numeric style={{ minWidth: 28 }}>
        {group.date.slice(8)}
      </Text>
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: theme.radius.pill,
          backgroundColor: isToday ? theme.colors.primary : theme.colors.surfaceMuted,
        }}
      >
        <Text variant="caption" color={isToday ? 'onPrimary' : 'textSecondary'}>
          {isToday ? 'Today' : weekday.format(parseIsoDate(group.date))}
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      {group.income ? (
        <Text variant="label" color="income" numeric>
          {formatEntry(group.income, 'always')}
        </Text>
      ) : null}
      {group.expense ? (
        <Text variant="label" color="expense" numeric>
          {formatEntry(-group.expense, 'always')}
        </Text>
      ) : null}
    </View>
  );
}
