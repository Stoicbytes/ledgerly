import type { RecurringEntry } from '@/lib/domain/expenses';
import type { Goal } from '@/lib/domain/investments';
import type { Employer, Payslip, PfEntry } from '@/lib/domain/salary';
import { diffById, type CollectionDiff } from '@/lib/domain/sync';
import { goalRow, goalsFromRemote } from './goalRows';
import { recurringFromRemote, recurringRow } from './recurringRows';
import {
  employerRow,
  employersFromRemote,
  payslipRow,
  payslipsFromRemote,
  pfEntriesFromRemote,
  pfEntryRow,
} from './salaryRows';

/**
 * Data from later migrations (recurring entries 0012, goals 0013, salary and PF 0016):
 * undefined while the database does not have them, and never sent until it does.
 */
export type Extras = {
  recurring?: RecurringEntry[];
  goals?: Goal[];
  employers?: Employer[];
  payslips?: Payslip[];
  pfEntries?: PfEntry[];
};

export type ExtraKey = 'recurring' | 'goals' | 'employers' | 'payslips' | 'pf_entries';

export const extrasFromRemote = (data: Partial<Record<ExtraKey, unknown>>): Extras => ({
  recurring: recurringFromRemote(data.recurring),
  goals: goalsFromRemote(data.goals),
  employers: employersFromRemote(data.employers),
  payslips: payslipsFromRemote(data.payslips),
  pfEntries: pfEntriesFromRemote(data.pf_entries),
});

type Upserts = Partial<Record<ExtraKey, unknown[]>>;
type Deletes = Partial<Record<ExtraKey, string[]>>;

/** Diffs one collection and adds its rows and deleted ids under `key`. */
function collection<T extends { id: string }>(
  key: ExtraKey,
  pick: (extras: Extras) => T[] | undefined,
  row: (item: T) => unknown,
) {
  return (previous: Extras, next: Extras, upserts: Upserts, deletes: Deletes) => {
    const diff = diffById(pick(previous) ?? [], pick(next) ?? [], row);
    if (diff.upserts.length) upserts[key] = diff.upserts.map(row);
    if (diff.deletes.length) deletes[key] = diff.deletes;
    return diff as CollectionDiff<unknown>;
  };
}

const COLLECTIONS = [
  collection('recurring', (e) => e.recurring, recurringRow),
  collection('goals', (e) => e.goals, goalRow),
  collection('employers', (e) => e.employers, employerRow),
  collection('payslips', (e) => e.payslips, payslipRow),
  collection('pf_entries', (e) => e.pfEntries, pfEntryRow),
];

export function extrasChanges(previous: Extras, next: Extras) {
  const upserts: Upserts = {};
  const deletes: Deletes = {};
  const diffs = COLLECTIONS.map((diff) => diff(previous, next, upserts, deletes));
  return { diffs, upserts, deletes };
}
