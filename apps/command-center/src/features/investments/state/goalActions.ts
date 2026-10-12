import type { Goal } from '@/lib/domain/investments';
import { newId } from '@/lib/ids';
import { useGoalStore } from './goalStore';
import { usePortfolioStore } from './portfolioStore';

export type GoalInput = Omit<Goal, 'id' | 'createdAt'>;

export function saveGoal(input: GoalInput, id?: string | null): Goal {
  const { goals } = useGoalStore.getState();
  const existing = id ? goals.find((goal) => goal.id === id) : undefined;
  const goal: Goal = {
    ...input,
    name: input.name.trim(),
    id: existing?.id ?? newId(),
    createdAt: existing?.createdAt ?? Date.now(),
  };
  useGoalStore.setState({
    goals: existing ? goals.map((item) => (item.id === goal.id ? goal : item)) : [...goals, goal],
  });
  return goal;
}

/**
 * Deletes a goal and unties its funds (as the database does), returning what Undo needs.
 */
export function deleteGoal(id: string): (() => void) | null {
  const { goals } = useGoalStore.getState();
  const goal = goals.find((item) => item.id === id);
  if (!goal) return null;
  const { funds } = usePortfolioStore.getState();
  const tied = funds.filter((fund) => fund.goalId === id).map((fund) => fund.id);
  useGoalStore.setState({ goals: goals.filter((item) => item.id !== id) });
  usePortfolioStore.setState({
    funds: funds.map((fund) => (fund.goalId === id ? { ...fund, goalId: null } : fund)),
  });
  return () => {
    useGoalStore.setState({ goals: [...useGoalStore.getState().goals, goal] });
    usePortfolioStore.setState({
      funds: usePortfolioStore
        .getState()
        .funds.map((fund) => (tied.includes(fund.id) ? { ...fund, goalId: id } : fund)),
    });
  };
}
