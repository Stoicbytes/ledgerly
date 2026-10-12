import type { RecurringEntry } from '@/lib/domain/expenses';
import { diffById } from '@/lib/domain/sync';

/** `recurring_entries` (migration 0012) to and from the app. */
type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** Null when the database has no recurring entries yet (migration 0012 not applied). */
export function recurringFromRemote(rows: unknown): RecurringEntry[] | undefined {
  if (!Array.isArray(rows)) return undefined;
  return (rows as Row[]).map((row) => ({
    id: str(row.id),
    kind: str(row.kind) as RecurringEntry['kind'],
    amount: num(row.amount),
    accountId: str(row.account_id),
    toAccountId: (row.to_account_id as string | null) ?? null,
    fee: num(row.fee),
    categoryId: (row.category_id as string | null) ?? null,
    note: str(row.note),
    frequency: str(row.frequency) as RecurringEntry['frequency'],
    startDate: str(row.start_date),
    nextDate: str(row.next_date),
    createdAt: Date.parse(str(row.created_at)) || 0,
  }));
}

const recurringRow = (r: RecurringEntry) => ({
  id: r.id,
  kind: r.kind,
  amount: r.amount,
  account_id: r.accountId,
  to_account_id: r.toAccountId,
  fee: r.fee,
  category_id: r.categoryId,
  note: r.note,
  frequency: r.frequency,
  start_date: r.startDate,
  next_date: r.nextDate,
  created_at: new Date(r.createdAt || Date.now()).toISOString(),
});

/** What changed in the recurring entries (nothing is sent before migration 0012). */
export function recurringChanges(
  previous: RecurringEntry[] | undefined,
  next: RecurringEntry[] | undefined,
) {
  return diffById(previous ?? [], next ?? [], recurringRow);
}

export { recurringRow };
