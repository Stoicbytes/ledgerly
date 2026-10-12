import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { Screen, useFitMode } from '@/components/layout/Screen';
import { Card } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import { CalendarView } from '../components/CalendarView';
import { CategoryPanel } from '../components/CategoryPanel';
import { DailyView } from '../components/DailyView';
import { DayPanel } from '../components/DayPanel';
import { ExpensesHeader } from '../components/ExpensesHeader';
import { MonthlyView } from '../components/MonthlyView';
import { RecurringDueCard } from '../recurring/RecurringDueCard';
import { SummaryStrip } from '../components/SummaryStrip';
import { useActiveView, ViewToolbar } from '../components/ViewToolbar';
import { YearPanel } from '../components/YearPanel';

/**
 * Expenses › Transactions. One month at a time in three views (Daily, Calendar,
 * Monthly) with a context panel; a single screen on desktop.
 */
export function TransactionsScreen() {
  const theme = useTheme();
  const fit = useFitMode(true);
  const { isMobile } = useBreakpoint();
  const view = useActiveView();
  const grow = fit ? { flex: 1 } : undefined;
  // Phones show the daily list alone, like Money Manager; Stats has the breakdown.
  const panel =
    view === 'calendar' ? (
      <DayPanel style={grow} />
    ) : view === 'monthly' ? (
      <YearPanel style={grow} />
    ) : isMobile ? null : (
      <CategoryPanel style={grow} />
    );
  return (
    <Screen fit>
      <ExpensesHeader />
      <SummaryStrip />
      <RecurringDueCard />
      <BentoRow stackBelow="desktop" fill={1}>
        <BentoCell flex={8}>
          <Card index={1} padding={4} style={[{ gap: theme.space[3] }, grow]}>
            <ViewToolbar />
            {view === 'calendar' ? (
              <CalendarView fill={fit} />
            ) : view === 'daily' ? (
              <DailyView />
            ) : (
              <MonthlyView />
            )}
          </Card>
        </BentoCell>
        {panel ? <BentoCell flex={4}>{panel}</BentoCell> : null}
      </BentoRow>
    </Screen>
  );
}
