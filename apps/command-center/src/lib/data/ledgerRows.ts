import type { Account, Category, Person } from '@/lib/domain/expenses';
import type { Note } from '@/lib/domain/notes';

/** App rows → `sync_ledger` rows (database column names). */
const isoTime = (ms: number) => new Date(ms || Date.now()).toISOString();

export const accountRow = (a: Account) => ({
  id: a.id,
  name: a.name,
  account_group: a.group,
  opening_balance: a.openingBalance,
  sort_order: a.order,
});
export const categoryRow = (c: Category) => ({
  id: c.id,
  kind: c.kind,
  parent_id: c.parentId,
  name: c.name,
  icon: c.icon,
  tint: c.tint,
  budget: c.budget,
  sort_order: c.order,
});
export const personRow = (p: Person) => ({ id: p.id, name: p.name, sort_order: p.order });
export const noteRow = (n: Note) => ({
  id: n.id,
  title: n.title,
  body: n.body,
  // Fixed key order: the database stores JSON objects with its own key order.
  items: n.items?.map((item) => ({ id: item.id, text: item.text, done: item.done })) ?? null,
  color: n.color,
  pinned: n.pinned,
  archived: n.archived,
  labels: n.labels,
  remind_on: n.remindOn ?? null,
  trashed_at: n.trashedAt ? isoTime(n.trashedAt) : null,
  created_at: isoTime(n.createdAt),
});

const noteTime = (value: unknown) => {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

/** A row of `notes` as the app's Note (reminder and deletion date from migration 0015). */
export const noteFromRemote = (row: Record<string, unknown>): Note => ({
  id: String(row.id ?? ''),
  title: typeof row.title === 'string' ? row.title : '',
  body: typeof row.body === 'string' ? row.body : '',
  items: Array.isArray(row.items) ? (row.items as Note['items']) : null,
  color: ((typeof row.color === 'string' && row.color) || 'default') as Note['color'],
  pinned: row.pinned === true,
  archived: row.archived === true,
  labels: Array.isArray(row.labels) ? (row.labels as string[]) : [],
  remindOn: typeof row.remind_on === 'string' ? row.remind_on.slice(0, 10) : null,
  trashedAt: noteTime(row.trashed_at) || null,
  createdAt: noteTime(row.created_at),
  updatedAt: noteTime(row.updated_at),
});
