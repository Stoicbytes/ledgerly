import { daysBetween } from './math';

/** Something the funds are for: retirement, a house, a child's education. */
export type Goal = {
  id: string;
  name: string;
  /** Paise. */
  targetAmount: number;
  targetDate: string;
  /** Yearly return you expect, percent; used only for the projections below. */
  expectedReturn: number;
  createdAt: number;
};

/** Whole months from `today` to `date` (0 when it has passed). */
export function monthsUntil(today: string, date: string): number {
  if (date <= today) return 0;
  const months =
    (Number(date.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
    Number(date.slice(5, 7)) -
    Number(today.slice(5, 7)) -
    (Number(date.slice(8, 10)) < Number(today.slice(8, 10)) ? 1 : 0);
  return Math.max(0, months);
}

export type GoalProgress = {
  goal: Goal;
  /** Today's value of the funds tied to the goal, paise. */
  current: number;
  /** Share of the target reached, 0–100. */
  percent: number;
  months: number;
  /** Today's value grown at the expected return until the date. */
  projected: number;
  /** Monthly investment still needed to close the gap (0 when on track). */
  monthlyNeeded: number;
  reached: boolean;
};

/**
 * Where a goal stands. The projection grows today's value at the expected return; the
 * monthly amount is what closes the rest by the date, invested at the end of each month
 * at the same return. Estimates only: real returns vary.
 */
export function goalProgress(goal: Goal, current: number, today: string): GoalProgress {
  const months = monthsUntil(today, goal.targetDate);
  const monthly = goal.expectedReturn / 100 / 12;
  const projected = Math.round(current * (1 + monthly) ** months);
  const gap = Math.max(0, goal.targetAmount - projected);
  let monthlyNeeded = 0;
  if (gap > 0 && months > 0) {
    monthlyNeeded = monthly
      ? Math.ceil((gap * monthly) / ((1 + monthly) ** months - 1))
      : Math.ceil(gap / months);
  }
  return {
    goal,
    current,
    percent: goal.targetAmount ? Math.min(100, (current / goal.targetAmount) * 100) : 0,
    months,
    projected,
    monthlyNeeded,
    reached: current >= goal.targetAmount,
  };
}

/** Years and months left, e.g. "4 years 2 months" or "Date passed". */
export function timeLeftLabel(today: string, date: string): string {
  const months = monthsUntil(today, date);
  if (!months) return daysBetween(today, date) > 0 ? 'Under a month' : 'Date passed';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const part = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;
  return [years ? part(years, 'year') : '', rest ? part(rest, 'month') : '']
    .filter(Boolean)
    .join(' ');
}
