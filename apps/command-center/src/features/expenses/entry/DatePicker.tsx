import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { IconButton, Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import {
  addDays,
  addMonths,
  calendarWeeks,
  dayLabel,
  monthLabel,
  monthOf,
  todayIso,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { PickChip } from './PickChip';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Month grid for the entry date, with Today / Yesterday shortcuts. */
export function DatePicker({
  value,
  onChoose,
}: {
  value: string;
  onChoose: (date: string) => void;
}) {
  const theme = useTheme();
  const [month, setMonth] = useState(monthOf(value));
  const today = todayIso();
  const yesterday = addDays(today, -1);
  return (
    <View style={{ gap: theme.space[3] }}>
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        <PickChip label="Today" selected={value === today} onPress={() => onChoose(today)} />
        <PickChip
          label="Yesterday"
          selected={value === yesterday}
          onPress={() => onChoose(yesterday)}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton
          icon={ChevronLeft}
          size="sm"
          accessibilityLabel="Previous month"
          onPress={() => setMonth(addMonths(month, -1))}
        />
        <Text
          variant="bodyStrong"
          align="center"
          style={{ flex: 1 }}
          accessibilityLiveRegion="polite"
        >
          {monthLabel(month)}
        </Text>
        <IconButton
          icon={ChevronRight}
          size="sm"
          accessibilityLabel="Next month"
          onPress={() => setMonth(addMonths(month, 1))}
        />
      </View>
      <View style={{ flexDirection: 'row' }} aria-hidden>
        {WEEKDAYS.map((day, index) => (
          <Text
            key={index}
            variant="caption"
            color="textTertiary"
            align="center"
            style={{ flex: 1 }}
          >
            {day}
          </Text>
        ))}
      </View>
      <View style={{ gap: 2 }}>
        {calendarWeeks(month).map((week) => (
          <View key={week[0]} style={{ flexDirection: 'row' }}>
            {week.map((date) => (
              <DayButton
                key={date}
                date={date}
                inMonth={monthOf(date) === month}
                selected={date === value}
                isToday={date === today}
                onPress={() => onChoose(date)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

type DayButtonProps = {
  date: string;
  inMonth: boolean;
  selected: boolean;
  isToday: boolean;
  onPress: () => void;
};

function DayButton({ date, inMonth, selected, isToday, onPress }: DayButtonProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        role="button"
        accessibilityLabel={`${dayLabel(date)}${isToday ? ', today' : ''}`}
        accessibilityState={{ selected }}
        onPress={onPress}
        {...handlers}
        style={[
          {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: isToday && !selected ? 2 : 0,
            borderColor: theme.colors.primary,
            backgroundColor: selected
              ? theme.colors.ink
              : hovered
                ? theme.colors.surfaceMuted
                : 'transparent',
          },
          focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
        ]}
      >
        <Text
          variant="label"
          color={selected ? 'onInk' : inMonth ? 'textPrimary' : 'textTertiary'}
          numeric
        >
          {Number(date.slice(8))}
        </Text>
      </Pressable>
    </View>
  );
}
