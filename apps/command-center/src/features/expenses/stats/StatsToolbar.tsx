import { View } from 'react-native';
import { SegmentedControl, type Segment } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { CategoryKind } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { AccountFilter } from '../components/ViewToolbar';
import { useExpenseUi } from '../state/expenseUi';
import type { StatsView } from './useStatsView';

const periods: readonly Segment<'month' | 'year'>[] = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

/** Income ⇄ Expenses (with their totals, as in Money Manager), Month ⇄ Year, and the account. */
export function StatsToolbar({ view }: { view: StatsView }) {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  const setKind = useExpenseUi((state) => state.setStatsKind);
  const setPeriod = useExpenseUi((state) => state.setStatsPeriod);
  const kinds: readonly Segment<CategoryKind>[] = [
    { value: 'income', label: `Income ${formatMoneyWhole(view.totals.income)}`, tone: 'income' },
    {
      value: 'expense',
      label: `Expenses ${formatMoneyWhole(view.totals.expense)}`,
      tone: 'expense',
    },
  ];
  return (
    <View
      style={{
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: theme.space[3],
      }}
    >
      <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: theme.space[3] }}>
        <SegmentedControl
          segments={kinds}
          value={view.kind}
          onChange={setKind}
          accessibilityLabel="Show income or expenses"
          fill={isMobile}
          size="sm"
        />
        <SegmentedControl
          segments={periods}
          value={view.period}
          onChange={setPeriod}
          accessibilityLabel="Period"
          fill={isMobile}
          size="sm"
        />
      </View>
      <AccountFilter />
    </View>
  );
}
