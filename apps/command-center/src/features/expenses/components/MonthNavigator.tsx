import { View } from 'react-native';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { Button, IconButton, Text } from '@/components/ui';
import { monthLabel, monthOf, todayIso, yearOfMonth } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { useExpenseUi } from '../state/expenseUi';

type MonthNavigatorProps = { mode?: 'month' | 'year'; stretch?: boolean };

/** ‹ October 2026 › — the one period selector shared by every Expenses page. */
export function MonthNavigator({ mode = 'month', stretch = false }: MonthNavigatorProps) {
  const theme = useTheme();
  const month = useExpenseUi((state) => state.month);
  const shiftMonth = useExpenseUi((state) => state.shiftMonth);
  const goToCurrentMonth = useExpenseUi((state) => state.goToCurrentMonth);
  const current = monthOf(todayIso());
  const step = mode === 'year' ? 12 : 1;
  const label = mode === 'year' ? String(yearOfMonth(month)) : monthLabel(month);
  const isCurrent =
    mode === 'year' ? yearOfMonth(month) === yearOfMonth(current) : month === current;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[1],
        alignSelf: stretch ? 'stretch' : 'auto',
      }}
    >
      <View
        style={{
          flex: stretch ? 1 : undefined,
          flexDirection: 'row',
          alignItems: 'center',
          height: 38,
          paddingHorizontal: 4,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surface,
        }}
      >
        <IconButton
          icon={ChevronLeft}
          size="sm"
          accessibilityLabel={mode === 'year' ? 'Previous year' : 'Previous month'}
          onPress={() => shiftMonth(-step)}
        />
        <Text
          variant="bodyStrong"
          align="center"
          numeric
          accessibilityLiveRegion="polite"
          style={{ minWidth: mode === 'year' ? 56 : 120, flex: stretch ? 1 : undefined }}
        >
          {label}
        </Text>
        <IconButton
          icon={ChevronRight}
          size="sm"
          accessibilityLabel={mode === 'year' ? 'Next year' : 'Next month'}
          onPress={() => shiftMonth(step)}
        />
      </View>
      {isCurrent ? null : (
        <Button label="Today" variant="ghost" size="sm" onPress={goToCurrentMonth} />
      )}
    </View>
  );
}
