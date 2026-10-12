import type { RecurringEntry } from '@/lib/domain/expenses';
import type { Goal } from '@/lib/domain/investments';
import { goalChanges, goalRow, goalsFromRemote } from './goalRows';
import { recurringChanges, recurringFromRemote, recurringRow } from './recurringRows';

/**
 * Data from later migrations (recurring entries 0012, goals 0013): undefined while the
 * database does not have them, and never sent until it does.
 */
type Extras = { recurring?: RecurringEntry[]; goals?: Goal[] };

export const extrasFromRemote = (data: { recurring?: unknown; goals?: unknown }): Extras => ({
  recurring: recurringFromRemote(data.recurring),
  goals: goalsFromRemote(data.goals),
});

export function extrasChanges(previous: Extras, next: Extras) {
  const recurring = recurringChanges(previous.recurring, next.recurring);
  const goals = goalChanges(previous.goals, next.goals);
  return {
    diffs: [recurring, goals],
    upserts: {
      ...(recurring.upserts.length ? { recurring: recurring.upserts.map(recurringRow) } : {}),
      ...(goals.upserts.length ? { goals: goals.upserts.map(goalRow) } : {}),
    },
    deletes: {
      ...(recurring.deletes.length ? { recurring: recurring.deletes } : {}),
      ...(goals.deletes.length ? { goals: goals.deletes } : {}),
    },
  };
}
