import { useState } from 'react';
import { Pressable, View, type LayoutRectangle } from 'react-native';
import { Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { dayLabel, type CalendarDay } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { signedCompact, speakEntry } from '../format';
import { useMonthView } from '../hooks/useMonthView';
import { useExpenseUi } from '../state/expenseUi';
import { useTransactionForm } from '../state/transactionForm';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GAP = 4;
/** Phones: tighter gaps and padding so "−1.4K" still fits a ~44 pt cell. */
const NARROW_GAP = 3;

/**
 * Month grid in the style of Money Manager's calendar: each day shows what
 * came in and what went out. Tapping a day selects it. An empty day, or the day
 * already selected, also opens "Add" on that date: a day with entries shows them
 * first in the day panel (which has its own Add), so browsing days stays one tap.
 */
export function CalendarView({ fill }: { fill: boolean }) {
  const theme = useTheme();
  const { weeks, focusDay, today } = useMonthView();
  const selectDate = useExpenseUi((state) => state.selectDate);
  const openNew = useTransactionForm((state) => state.openNew);
  const [grid, setGrid] = useState<LayoutRectangle | null>(null);
  const rowHeight = fill && grid ? (grid.height - GAP * (weeks.length - 1)) / weeks.length : 60;
  const narrow = grid ? (grid.width - GAP * 6) / 7 < 64 : false;
  const gap = narrow ? NARROW_GAP : GAP;
  return (
    <View style={[{ gap: theme.space[2] }, fill && { flex: 1, minHeight: 0 }]}>
      <View style={{ flexDirection: 'row', gap }}>
        {WEEKDAYS.map((day) => (
          <Text
            key={day}
            variant="caption"
            color="textTertiary"
            align="center"
            style={{ flex: 1 }}
            aria-hidden
          >
            {narrow ? day.slice(0, 1) : day}
          </Text>
        ))}
      </View>
      <View
        onLayout={(event) => setGrid(event.nativeEvent.layout)}
        style={[{ gap }, fill && { flex: 1, minHeight: 0 }]}
      >
        {weeks.map((week) => (
          <View
            key={week[0].date}
            style={[
              { flexDirection: 'row', gap },
              fill ? { flex: 1, minHeight: 0 } : { height: rowHeight },
            ]}
          >
            {week.map((day) => (
              <DayCell
                key={day.date}
                day={day}
                compact={rowHeight < 56}
                narrow={narrow}
                selected={day.date === focusDay}
                isToday={day.date === today}
                onPress={() => {
                  const opensAdd = day.count === 0 || day.date === focusDay;
                  selectDate(day.date);
                  if (opensAdd) openNew({ date: day.date });
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

type DayCellProps = {
  day: CalendarDay;
  /** Short rows show the day's spending only (income as a dot). */
  compact: boolean;
  /** Narrow cells drop the currency symbol. */
  narrow: boolean;
  selected: boolean;
  isToday: boolean;
  onPress: () => void;
};

function DayCell({ day, compact, narrow, selected, isToday, onPress }: DayCellProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  const amount = (value: number, sign: '+' | '−') => {
    const text = signedCompact(value, sign);
    return narrow ? text.replace('₹', '') : text;
  };
  const parts = [
    day.income ? `received ${speakEntry(day.income)}` : '',
    day.expense ? `spent ${speakEntry(day.expense)}` : '',
  ].filter(Boolean);
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${dayLabel(day.date)}${isToday ? ', today' : ''}: ${parts.join(', ') || 'no entries'}`}
      accessibilityHint={
        day.count && !selected
          ? 'Shows this day; tap again to add an entry'
          : 'Adds an entry on this day'
      }
      accessibilityState={{ selected }}
      onPress={onPress}
      {...handlers}
      style={[
        {
          flex: 1,
          minWidth: 0,
          justifyContent: 'space-between',
          paddingHorizontal: narrow ? 2 : theme.space[2],
          paddingVertical: compact ? 3 : 6,
          borderRadius: theme.radius.sm,
          borderWidth: 1.5,
          borderColor: selected ? theme.colors.ink : hovered ? theme.colors.border : 'transparent',
          backgroundColor: selected
            ? theme.colors.primarySoft
            : day.inMonth
              ? theme.colors.surfaceMuted
              : 'transparent',
          opacity: day.inMonth ? 1 : 0.5,
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View
          style={[
            { minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
            isToday && { borderRadius: 11, backgroundColor: theme.colors.primary },
          ]}
        >
          <Text
            variant="label"
            color={isToday ? 'onPrimary' : day.inMonth ? 'textPrimary' : 'textTertiary'}
            numeric
          >
            {Number(day.date.slice(8))}
          </Text>
        </View>
        {compact && day.inMonth && day.income > 0 ? (
          <View
            aria-hidden
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.income }}
          />
        ) : null}
      </View>
      {day.inMonth ? (
        <View style={{ alignItems: 'flex-end' }}>
          {!compact && day.income > 0 ? (
            <Text variant="caption" color="income" numeric numberOfLines={1}>
              {amount(day.income, '+')}
            </Text>
          ) : null}
          {day.expense > 0 ? (
            <Text variant="caption" color="expense" numeric numberOfLines={1}>
              {amount(day.expense, '−')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
