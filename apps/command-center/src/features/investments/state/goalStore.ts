import { create } from 'zustand';
import { samples } from '@/features/preview/samples';
import type { Goal } from '@/lib/domain/investments';

type GoalState = {
  goals: Goal[];
  /** False while signed in to a database without migration 0013: goals are hidden. */
  available: boolean;
  resetPreview: () => void;
};

/** Investment goals; funds point at them with `goalId`. Changes go through goalActions. */
export const useGoalStore = create<GoalState>((set) => ({
  goals: samples()?.seedGoals() ?? [],
  available: true,
  resetPreview: () => set({ goals: samples()?.seedGoals() ?? [], available: true }),
}));
