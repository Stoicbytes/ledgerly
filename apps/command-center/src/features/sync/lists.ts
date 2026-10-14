import type { CloudData, LedgerChanges } from '@/lib/data/ledgerRepository';
import { LIST_KEYS, type ListKey } from '@/lib/data/saveResult';
import type { Portfolio } from '@/lib/domain/investments';

/**
 * The saved lists of `CloudData` by their database name, so a batch (database rows) can
 * be matched to the items in the stores: to move confirmed rows into the saved copy, or
 * to put back the saved version of a row the database refused.
 */
type Item = { id: string };
type TopKey = Exclude<keyof CloudData, 'portfolio' | 'noteExtras' | 'versions'>;

const IN_PORTFOLIO: Partial<Record<ListKey, keyof Portfolio>> = {
  mf_funds: 'funds',
  mf_sips: 'sips',
  mf_transactions: 'fundTxns',
  stocks: 'stocks',
  stock_trades: 'trades',
};
const TOP: Partial<Record<ListKey, TopKey>> = {
  accounts: 'accounts',
  categories: 'categories',
  people: 'people',
  transactions: 'transactions',
  notes: 'notes',
  recurring: 'recurring',
  goals: 'goals',
  employers: 'employers',
  payslips: 'payslips',
  pf_entries: 'pfEntries',
};

/** The items of one list, or undefined when the database does not have it yet. */
export function listOf(data: CloudData, list: ListKey): Item[] | undefined {
  const inPortfolio = IN_PORTFOLIO[list];
  if (inPortfolio) return data.portfolio[inPortfolio];
  return data[TOP[list] as TopKey] as Item[] | undefined;
}

function withList(data: CloudData, list: ListKey, items: Item[]): CloudData {
  const inPortfolio = IN_PORTFOLIO[list];
  if (inPortfolio) return { ...data, portfolio: { ...data.portfolio, [inPortfolio]: items } };
  return { ...data, [TOP[list] as TopKey]: items };
}

export const hasItem = (data: CloudData, list: ListKey, id: string) =>
  Boolean(listOf(data, list)?.some((item) => item.id === id));

/** Puts `item` in place of the one with its id (or at the end). */
export function putItem(data: CloudData, list: ListKey, item: Item): CloudData {
  const items = listOf(data, list);
  if (!items) return data;
  const at = items.findIndex((existing) => existing.id === item.id);
  const next = at < 0 ? [...items, item] : items.map((existing, i) => (i === at ? item : existing));
  return withList(data, list, next);
}

export function dropItem(data: CloudData, list: ListKey, id: string): CloudData {
  const items = listOf(data, list);
  if (!items?.some((item) => item.id === id)) return data;
  return withList(
    data,
    list,
    items.filter((item) => item.id !== id),
  );
}

/** `target` with the rows `ids` exactly as in `source` (missing there: removed). */
export function takeRows(
  target: CloudData,
  source: CloudData,
  list: ListKey,
  ids: Iterable<string>,
): CloudData {
  const items = listOf(target, list);
  const wanted = new Set(ids);
  if (!items || !wanted.size) return target;
  const from = new Map(
    (listOf(source, list) ?? []).filter((item) => wanted.has(item.id)).map((i) => [i.id, i]),
  );
  const present = new Set(items.map((item) => item.id));
  const result = items.flatMap((item) => {
    if (!wanted.has(item.id)) return [item];
    const replacement = from.get(item.id);
    return replacement ? [replacement] : [];
  });
  for (const [id, item] of from) if (!present.has(id)) result.push(item);
  return withList(target, list, result);
}

/** The ids a batch saves and deletes, per list. */
export function idsOf(changes: LedgerChanges): Partial<Record<ListKey, string[]>> {
  const ids: Partial<Record<ListKey, string[]>> = {};
  for (const list of LIST_KEYS) {
    const rows = (changes[list] ?? []) as { id?: unknown }[];
    const all = [
      ...rows.map((row) => String(row.id)),
      ...(changes.deleted?.[list] ?? []).map(String),
    ];
    if (all.length) ids[list] = all;
  }
  return ids;
}

/** `target` with every row of `changes` taken from `source`. */
export function takeChanged(
  target: CloudData,
  source: CloudData,
  changes: LedgerChanges,
): CloudData {
  let result = target;
  for (const [list, ids] of Object.entries(idsOf(changes)) as [ListKey, string[]][]) {
    result = takeRows(result, source, list, ids);
  }
  return result;
}

/** How many rows a batch saves or deletes. */
export const countRows = (changes: LedgerChanges) =>
  Object.values(idsOf(changes)).reduce((sum, ids) => sum + (ids?.length ?? 0), 0);
