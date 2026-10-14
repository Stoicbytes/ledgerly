import type { Portfolio } from '@/lib/domain/investments';
import type { LedgerData } from './types';

/** The lists a backup restores, in the order they can be saved (things before their users). */
export const RESTORE_KINDS = [
  'accounts',
  'people',
  'categories',
  'goals',
  'notes',
  'employers',
  'stocks',
  'funds',
  'sips',
  'fundTxns',
  'trades',
  'transactions',
  'recurring',
  'payslips',
  'pfEntries',
] as const;
export type RestoreKind = (typeof RESTORE_KINDS)[number];

export const KIND_LABELS: Record<RestoreKind, [string, string]> = {
  accounts: ['account', 'accounts'],
  people: ['person', 'people'],
  categories: ['category', 'categories'],
  goals: ['goal', 'goals'],
  notes: ['note', 'notes'],
  employers: ['employer', 'employers'],
  stocks: ['share', 'shares'],
  funds: ['fund', 'funds'],
  sips: ['SIP', 'SIPs'],
  fundTxns: ['fund transaction', 'fund transactions'],
  trades: ['share trade', 'share trades'],
  transactions: ['entry', 'entries'],
  recurring: ['recurring entry', 'recurring entries'],
  payslips: ['payslip', 'payslips'],
  pfEntries: ['PF entry', 'PF entries'],
};

type Item = { id: string };
const PORTFOLIO = new Set<string>(['funds', 'sips', 'fundTxns', 'stocks', 'trades']);

/** One list of the data; undefined when the database (or file) does not have it. */
export const itemsOf = (data: LedgerData, kind: RestoreKind): Item[] | undefined =>
  PORTFOLIO.has(kind)
    ? data.portfolio[kind as keyof Portfolio]
    : (data[kind as Exclude<RestoreKind, keyof Portfolio>] as Item[] | undefined);

/** Builds data from one list per kind (missing kinds stay undefined, or empty when required). */
export function dataOf(lists: Partial<Record<RestoreKind, Item[]>>): LedgerData {
  const pick = <T>(kind: RestoreKind) => (lists[kind] ?? []) as T[];
  return {
    accounts: pick('accounts'),
    categories: pick('categories'),
    people: pick('people'),
    transactions: pick('transactions'),
    notes: pick('notes'),
    portfolio: {
      funds: pick('funds'),
      sips: pick('sips'),
      fundTxns: pick('fundTxns'),
      stocks: pick('stocks'),
      trades: pick('trades'),
    },
    recurring: lists.recurring as LedgerData['recurring'],
    goals: lists.goals as LedgerData['goals'],
    employers: lists.employers as LedgerData['employers'],
    payslips: lists.payslips as LedgerData['payslips'],
    pfEntries: lists.pfEntries as LedgerData['pfEntries'],
  };
}

/** JSON with sorted keys, leaving out times the server keeps, for comparing records. */
export function contentKey(value: unknown): string {
  const IGNORED = new Set(['createdAt', 'updatedAt', 'photo']);
  const walk = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(walk);
    if (!item || typeof item !== 'object') return item;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(item).sort()) {
      if (!IGNORED.has(key)) out[key] = walk((item as Record<string, unknown>)[key]);
    }
    return out;
  };
  const normal = walk(value) as Record<string, unknown>;
  // Splits and settles come back from the database in no particular order.
  for (const key of ['splits', 'settles']) {
    if (Array.isArray(normal?.[key])) {
      normal[key] = (normal[key] as unknown[]).map((x) => JSON.stringify(x)).sort();
    }
  }
  return JSON.stringify(normal);
}

/** `current` with the records of `add` appended (lists the database lacks stay absent). */
export function withAdded(current: LedgerData, add: LedgerData): LedgerData {
  const lists: Partial<Record<RestoreKind, Item[]>> = {};
  for (const kind of RESTORE_KINDS) {
    const here = itemsOf(current, kind);
    if (here) lists[kind] = [...here, ...(itemsOf(add, kind) ?? [])];
  }
  return dataOf(lists);
}
