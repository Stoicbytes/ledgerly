import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { CalendarDays, Plus } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Button, Card, CardHeader, Text } from '@/components/ui';
import { dayLabel } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { formatEntry } from '../format';
import { useMonthView } from '../hooks/useMonthView';
import { useTransactionForm } from '../state/transactionForm';
import { LedgerRow } from './LedgerRow';
import { PanelScroll } from '@/components/layout/PanelScroll';

/** The selected calendar day: its totals, its entries and "Add on this day". */
export function DayPanel({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const { focusDay, groups, accountId, today } = useMonthView();
  const openNew = useTransactionForm((state) => state.openNew);
  const group = groups.find((item) => item.date === focusDay);
  const count = group?.items.length ?? 0;
  return (
    <Card index={2} style={[{ gap: theme.space[3] }, style]}>
      <CardHeader
        title={focusDay === today ? 'Today' : dayLabel(focusDay, 'short')}
        subtitle={`${focusDay === today ? `${dayLabel(focusDay, 'short')} · ` : ''}${count ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'No entries'}`}
        action={
          <Button
            label="Add"
            icon={Plus}
            size="sm"
            variant="ink"
            accessibilityLabel={`Add an entry on ${dayLabel(focusDay)}`}
            onPress={() => openNew({ date: focusDay })}
          />
        }
      />
      {group ? (
        <>
          <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
            <TotalPill label="In" value={group.income} tone="income" />
            <TotalPill label="Out" value={-group.expense} tone="expense" />
          </View>
          <PanelScroll>
            {group.items.map((transaction) => (
              <LedgerRow key={transaction.id} transaction={transaction} accountId={accountId} />
            ))}
          </PanelScroll>
        </>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Nothing recorded"
          body="Add what you spent or received on this day, or pick another day."
        />
      )}
    </Card>
  );
}

function TotalPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'income' | 'expense';
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.space[3],
        paddingVertical: theme.space[2],
        borderRadius: theme.radius.md,
        backgroundColor: tone === 'income' ? theme.colors.incomeSoft : theme.colors.expenseSoft,
      }}
    >
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Text variant="bodyStrong" color={value ? tone : 'textTertiary'} numeric numberOfLines={1}>
        {formatEntry(value, value ? 'always' : 'auto')}
      </Text>
    </View>
  );
}
