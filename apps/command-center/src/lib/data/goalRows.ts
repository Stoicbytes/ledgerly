import type { Goal } from '@/lib/domain/investments';

/** `investment_goals` (migration 0013) to and from the app. */
type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** Undefined when the database has no goals yet (migration 0013 not applied). */
export function goalsFromRemote(rows: unknown): Goal[] | undefined {
  if (!Array.isArray(rows)) return undefined;
  return (rows as Row[]).map((row) => ({
    id: str(row.id),
    name: str(row.name),
    targetAmount: num(row.target_amount),
    targetDate: str(row.target_date),
    expectedReturn: num(row.expected_return),
    createdAt: Date.parse(str(row.created_at)) || 0,
  }));
}

export const goalRow = (g: Goal) => ({
  id: g.id,
  name: g.name,
  target_amount: g.targetAmount,
  target_date: g.targetDate,
  expected_return: g.expectedReturn,
  created_at: new Date(g.createdAt || Date.now()).toISOString(),
});
