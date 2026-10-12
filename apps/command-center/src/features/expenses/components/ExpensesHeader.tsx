import { useState } from 'react';
import { View } from 'react-native';
import { Plus, Repeat, Search } from '@/components/icons';
import { Button, Heading, IconButton } from '@/components/ui';
import { SampleDataBadge } from '@/features/preview/SampleDataBadge';
import { StarterCard } from '@/features/sync/StarterCard';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { useExpenseUi } from '../state/expenseUi';
import { RecurringSheet } from '../recurring/RecurringSheet';
import { useRecurringStore } from '../state/recurringStore';
import { useSearchStore } from '../state/searchStore';
import { useTransactionForm } from '../state/transactionForm';
import { MonthNavigator } from './MonthNavigator';
import { SectionTabs } from './SectionTabs';

/** Wide enough for title, tabs, navigator and Add on one line. */
const ONE_ROW_MIN_WIDTH = 1340;

/** Header shared by every Expenses page: title, section tabs, period and Add. */
export function ExpensesHeader({ period = 'month' }: { period?: 'month' | 'year' | 'none' }) {
  const theme = useTheme();
  const { isMobile, width } = useBreakpoint();
  const openNew = useTransactionForm((state) => state.openNew);
  const selectedDate = useExpenseUi((state) => state.selectedDate);
  const title = (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3], flexWrap: 'wrap' }}
    >
      <Heading level={1} variant="h2">
        Expenses
      </Heading>
      <SampleDataBadge editable />
    </View>
  );
  const navigator = period === 'none' ? null : <MonthNavigator mode={period} stretch={isMobile} />;
  const showSearch = useSearchStore((state) => state.show);
  const recurringAvailable = useRecurringStore((state) => state.available);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const search = (
    <>
      {recurringAvailable ? (
        <IconButton
          icon={Repeat}
          variant="surface"
          accessibilityLabel="Recurring entries"
          onPress={() => setRecurringOpen(true)}
        />
      ) : null}
      <RecurringSheet visible={recurringOpen} onClose={() => setRecurringOpen(false)} />
      <IconButton
        icon={Search}
        variant="surface"
        accessibilityLabel="Search and export entries"
        onPress={showSearch}
      />
    </>
  );
  const add = (
    <Button
      label="Add"
      icon={Plus}
      size={isMobile ? 'sm' : 'md'}
      accessibilityLabel="Add a transaction"
      onPress={() => openNew(selectedDate ? { date: selectedDate } : undefined)}
    />
  );
  if (isMobile) {
    return (
      <View style={{ gap: theme.space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
          <View style={{ flex: 1 }}>{title}</View>
          {search}
          {add}
        </View>
        <SectionTabs />
        {navigator}
        <StarterCard />
      </View>
    );
  }
  const oneRow = width >= ONE_ROW_MIN_WIDTH;
  return (
    <View style={{ gap: theme.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[4] }}>
        {title}
        {oneRow ? <SectionTabs /> : null}
        <View style={{ flex: 1 }} />
        {navigator}
        {search}
        {add}
      </View>
      {oneRow ? null : <SectionTabs />}
      <StarterCard />
    </View>
  );
}
