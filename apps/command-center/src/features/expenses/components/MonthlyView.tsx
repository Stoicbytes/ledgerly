import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown, ChevronRight, List } from '@/components/icons';
import { IconButton } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import {
  monthBounds,
  monthLabel,
  monthOf,
  parseIsoDate,
  todayIso,
  weekSummaries,
  yearOfMonth,
  yearSummary,
  type Totals,
} from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { useLedger } from '../hooks/useLedger';
import { useExpenseUi } from '../state/expenseUi';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { TotalsRow } from './TotalsRow';

const short = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const rangeText = (start: string, end: string) =>
  `${Number(start.slice(8))} – ${short.format(parseIsoDate(end))}`;

/** The year month by month, each expandable into weeks (Money Manager's Monthly tab). */
export function MonthlyView() {
  const theme = useTheme();
  const { transactions } = useLedger();
  const month = useExpenseUi((state) => state.month);
  const accountId = useExpenseUi((state) => state.accountId);
  const [open, setOpen] = useState<string | null>(month);
  const year = yearOfMonth(month);
  const current = monthOf(todayIso());
  const months = useMemo(
    () =>
      yearSummary(year, transactions, accountId)
        .filter((item) => yearOfMonth(current) !== year || item.month <= current)
        .reverse(),
    [year, transactions, accountId, current],
  );
  return (
    <View style={{ flex: 1, minHeight: 0, gap: theme.space[1] }}>
      <View style={{ flexDirection: 'row' }}>
        <TotalsRow label="Month" values={null} header />
      </View>
      <PanelScroll>
        {months.map((item) => (
          <MonthRow
            key={item.month}
            month={item.month}
            totals={item}
            selected={item.month === month}
            expanded={open === item.month}
            onToggle={() => setOpen(open === item.month ? null : item.month)}
          />
        ))}
      </PanelScroll>
    </View>
  );
}

type MonthRowProps = {
  month: string;
  totals: Totals;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
};

function MonthRow({ month, totals, selected, expanded, onToggle }: MonthRowProps) {
  const theme = useTheme();
  const { transactions } = useLedger();
  const accountId = useExpenseUi((state) => state.accountId);
  const setMonth = useExpenseUi((state) => state.setMonth);
  const setView = useExpenseUi((state) => state.setView);
  const { hovered, focused, handlers } = useInteractionState();
  const { start, end } = monthBounds(month);
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <View
      style={{
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primarySoft : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          role="button"
          aria-expanded={expanded}
          accessibilityLabel={`${monthLabel(month)}: income ${formatMoneyWhole(totals.income)}, expenses ${formatMoneyWhole(totals.expense)}. ${expanded ? 'Hide' : 'Show'} weeks`}
          onPress={onToggle}
          {...handlers}
          style={[
            { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: theme.radius.md },
            hovered && { backgroundColor: theme.colors.surfaceMuted },
            focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
          ]}
        >
          <View aria-hidden style={{ marginLeft: 6 }}>
            <Chevron size={16} color={theme.colors.textSecondary} />
          </View>
          <TotalsRow
            label={monthLabel(month, 'short')}
            caption={rangeText(start, end)}
            values={totals}
            strong
          />
        </Pressable>
        <IconButton
          icon={List}
          size="sm"
          accessibilityLabel={`Show ${monthLabel(month)} day by day`}
          onPress={() => {
            setMonth(month);
            setView('daily');
          }}
        />
      </View>
      {expanded
        ? weekSummaries(month, transactions, accountId).map((week) => (
            <View
              key={week.start}
              style={{ flexDirection: 'row', paddingLeft: 22, paddingRight: 36 }}
            >
              <TotalsRow
                label={rangeText(week.start, week.end)}
                values={week}
                upcoming={week.start > todayIso()}
              />
            </View>
          ))
        : null}
    </View>
  );
}
