import { addMonths, monthOf, todayIso } from '@/lib/domain/expenses';
import type { Goal } from '@/lib/domain/investments';

/** One sample goal for the preview, ten years out. */
export const seedGoals = (): Goal[] => [
  {
    id: 'goal-retire',
    name: 'Retirement corpus',
    targetAmount: 1_00_00_000_00,
    targetDate: `${addMonths(monthOf(todayIso()), 120)}-01`,
    expectedReturn: 11,
    createdAt: 0,
  },
];
