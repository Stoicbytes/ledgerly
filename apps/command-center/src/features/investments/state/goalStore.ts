import { create } from 'zustand';
import { addMonths, monthOf, todayIso } from '@/lib/domain/expenses';
import type { Goal } from '@/lib/domain/investments';

type GoalState = {
  goals: Goal[];
  /** False while signed in to a database without migration 0013: goals are hidden. */
  available: boolean;
  resetPreview: () => void;
};

/** One sample goal for the preview, ten years out. */
const seedGoals = (): Goal[] => [
  {
    id: 'goal-retire',
    name: 'Retirement corpus',
    targetAmount: 1_00_00_000_00,
    targetDate: `${addMonths(monthOf(todayIso()), 120)}-01`,
    expectedReturn: 11,
    createdAt: 0,
  },
];

/** Investment goals; funds point at them with `goalId`. Changes go through goalActions. */
export const useGoalStore = create<GoalState>((set) => ({
  goals: seedGoals(),
  available: true,
  resetPreview: () => set({ goals: seedGoals(), available: true }),
}));
