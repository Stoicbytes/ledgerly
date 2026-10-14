import type { Category } from '@/lib/domain/expenses';
import { contentKey, dataOf, itemsOf, RESTORE_KINDS, type RestoreKind } from './kinds';
import { remapped } from './remap';
import type { Backup, LedgerData } from './types';

export type KindCount = {
  inFile: number;
  /** Already here with the same id and content. */
  same: number;
  /** Already here with the same id but other content: the one here is kept. */
  changed: number;
  /** Not here by id, but one with the same name is (it is used instead). */
  matched: number;
  /** Left out because the same month or payslip is already here under another id. */
  clashes: number;
  add: number;
};

export type RestorePlan = {
  /** Only what is missing, with references pointing at what is kept here. */
  add: LedgerData;
  counts: Record<RestoreKind, KindCount>;
  /** Kinds in the file the database cannot keep yet (a migration is missing). */
  unavailable: RestoreKind[];
  range: { start: string; end: string } | null;
  total: number;
};

const norm = (name: string) => name.trim().toLowerCase();

/** Keys the database keeps unique besides the id (by name, symbol or month). */
function uniqueKey(kind: RestoreKind, item: Record<string, unknown>): string | null {
  switch (kind) {
    case 'accounts':
    case 'people':
      return norm(String(item.name));
    case 'categories':
      return `${item.kind}|${item.parentId ?? ''}|${norm(String(item.name))}`;
    case 'stocks':
      return `${item.exchange}|${item.symbol}`;
    case 'payslips':
      return `${item.employerId}|${item.month}`;
    case 'pfEntries':
      return item.payslipId ? String(item.payslipId) : null;
    default:
      return null;
  }
}
/** Same-name records are used as they are; same-month payslips are left out. */
const REUSE = new Set<RestoreKind>(['accounts', 'people', 'categories', 'stocks']);

/**
 * What restoring `backup` into `current` would add. Nothing here is deleted or changed:
 * a record whose id is already here is kept as it is (and counted as changed when it
 * differs); a record whose name is already taken uses the one here. Planning again
 * after a restore adds nothing.
 */
export function planRestore(backup: Backup, current: LedgerData): RestorePlan {
  const ids = new Map<string, string>();
  const skipped = new Set<string>();
  const lists: Partial<Record<RestoreKind, { id: string }[]>> = {};
  const counts = {} as Record<RestoreKind, KindCount>;
  const unavailable: RestoreKind[] = [];
  for (const kind of RESTORE_KINDS) {
    let items = itemsOf(backup.data, kind) ?? [];
    const here = itemsOf(current, kind);
    const count: KindCount = {
      inFile: items.length,
      same: 0,
      changed: 0,
      matched: 0,
      clashes: 0,
      add: 0,
    };
    counts[kind] = count;
    if (!here) {
      if (items.length) unavailable.push(kind);
      continue;
    }
    if (kind === 'categories') {
      // Top-level first, so a subcategory's parent is mapped before it.
      items = [...(items as Category[])].sort(
        (a, b) => Number(!!a.parentId) - Number(!!b.parentId),
      );
    }
    const byId = new Map(here.map((item) => [item.id, item]));
    const byKey = new Map<string, string>();
    for (const item of here) {
      const key = uniqueKey(kind, item as Record<string, unknown>);
      if (key) byKey.set(key, item.id);
    }
    const added: { id: string }[] = [];
    for (const original of items) {
      const item = remapped(kind, original, ids);
      const existing = byId.get(item.id);
      if (existing) {
        if (contentKey(existing) === contentKey(item)) count.same += 1;
        else count.changed += 1;
        continue;
      }
      const record = item as Record<string, unknown>;
      const key = uniqueKey(kind, record);
      const taken = key ? byKey.get(key) : undefined;
      const dropped = kind === 'pfEntries' && skipped.has(String(record.payslipId));
      if (taken && REUSE.has(kind)) {
        ids.set(item.id, taken);
        count.matched += 1;
      } else if (taken || dropped) {
        skipped.add(item.id);
        count.clashes += 1;
      } else {
        if (key) byKey.set(key, item.id);
        added.push(item);
        count.add += 1;
      }
    }
    lists[kind] = added;
  }
  const dates = backup.data.transactions.map((item) => item.date).sort();
  const total = RESTORE_KINDS.reduce((sum, kind) => sum + counts[kind].add, 0);
  return {
    add: dataOf(lists),
    counts,
    unavailable,
    range: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
    total,
  };
}
