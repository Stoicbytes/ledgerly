import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { Screen, useFitMode } from '@/components/layout/Screen';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { BudgetHero } from '../budget/BudgetHero';
import { BudgetsCard } from '../budget/BudgetsCard';
import { UnbudgetedCard } from '../budget/UnbudgetedCard';
import { useBudgetEditing } from '../budget/useBudgetEditing';
import { useBudgetView } from '../budget/useBudgetView';
import { ExpensesHeader } from '../components/ExpensesHeader';

/** Expenses › Budget: monthly budgets per category, edited in place. */
export function BudgetScreen() {
  const fit = useFitMode(true);
  const view = useBudgetView();
  const editing = useBudgetEditing();
  const { isDesktop } = useBreakpoint();
  const grow = fit ? { flex: 1 } : undefined;
  if (!isDesktop) {
    // Stacked: the budgets come before the categories that have none.
    return (
      <Screen>
        <ExpensesHeader />
        <BudgetHero view={view} />
        <BudgetsCard view={view} editing={editing} />
        <UnbudgetedCard view={view} editing={editing} />
      </Screen>
    );
  }
  return (
    <Screen fit>
      <ExpensesHeader />
      <BentoRow stackBelow="desktop" fill={1}>
        <BentoCell flex={4}>
          <BudgetHero view={view} />
          <UnbudgetedCard view={view} editing={editing} style={grow} />
        </BentoCell>
        <BentoCell flex={7}>
          <BudgetsCard view={view} editing={editing} style={grow} />
        </BentoCell>
      </BentoRow>
    </Screen>
  );
}
