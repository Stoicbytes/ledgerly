import {
  dueEntries,
  followingDate,
  todayIso,
  type DueEntry,
  type RecurringEntry,
  type RecurringFrequency,
  type Transaction,
  type ValidTransaction,
} from '@/lib/domain/expenses';
import { newId } from '@/lib/ids';
import { getLedger, useExpenseStore } from './expenseStore';
import { useRecurringStore } from './recurringStore';

const rules = () => useRecurringStore.getState().rules;
const setRules = (next: RecurringEntry[]) => useRecurringStore.setState({ rules: next });

/** A category deleted since the rule was made is cleared (as the database does). */
const known = (categoryId: string | null) =>
  categoryId && getLedger().categories.some((item) => item.id === categoryId) ? categoryId : null;

/** Makes a saved entry repeat from its date. Splits and repayments do not repeat. */
export function createRule(entry: ValidTransaction, frequency: RecurringFrequency): RecurringEntry {
  const base = { frequency, startDate: entry.date };
  const rule: RecurringEntry = {
    id: newId(),
    kind: entry.kind,
    amount: entry.amount,
    accountId: entry.accountId,
    toAccountId: entry.toAccountId,
    fee: entry.fee,
    categoryId: known(entry.categoryId),
    note: entry.note,
    ...base,
    nextDate: followingDate(base, entry.date),
    createdAt: Date.now(),
  };
  setRules([...rules(), rule]);
  return rule;
}

/** Marks `date` of the rule as handled (added or skipped). */
export function advanceRule(id: string, date: string): void {
  setRules(
    rules().map((rule) => {
      if (rule.id !== id || date < rule.nextDate) return rule;
      return { ...rule, categoryId: known(rule.categoryId), nextDate: followingDate(rule, date) };
    }),
  );
}

export type RulePatch = Pick<RecurringEntry, 'amount' | 'note' | 'frequency' | 'nextDate'>;

/** Changes amount, note, how often or the next date; a new rhythm starts from the next date. */
export function updateRule(id: string, patch: RulePatch): void {
  setRules(
    rules().map((rule) =>
      rule.id === id
        ? {
            ...rule,
            ...patch,
            categoryId: known(rule.categoryId),
            startDate:
              patch.frequency !== rule.frequency || patch.nextDate !== rule.nextDate
                ? patch.nextDate
                : rule.startDate,
          }
        : rule,
    ),
  );
}

/** Removes a rule (entries already added stay); returns it for Undo. */
export function deleteRule(id: string): RecurringEntry | null {
  const rule = rules().find((item) => item.id === id) ?? null;
  if (rule) setRules(rules().filter((item) => item.id !== id));
  return rule;
}

export function restoreRule(rule: RecurringEntry): void {
  setRules([...rules().filter((item) => item.id !== rule.id), rule]);
}

/** The entry a due date adds, or null when its account or category no longer exists. */
export function dueEntryValue({ rule, date }: DueEntry): ValidTransaction | null {
  const { accounts, categories } = getLedger();
  const has = (id: string | null) => !!id && accounts.some((account) => account.id === id);
  if (!has(rule.accountId) || (rule.kind === 'transfer' && !has(rule.toAccountId))) return null;
  const category = categories.find((item) => item.id === rule.categoryId);
  if (rule.kind !== 'transfer' && category?.kind !== rule.kind) return null;
  return {
    kind: rule.kind,
    date,
    amount: rule.amount,
    accountId: rule.accountId,
    toAccountId: rule.kind === 'transfer' ? rule.toAccountId : null,
    fee: rule.kind === 'transfer' ? rule.fee : 0,
    categoryId: rule.kind === 'transfer' ? null : rule.categoryId,
    note: rule.note,
    splits: [],
  };
}

/** Adds every due entry that can be added as it is; returns what Undo needs. */
export function addAllDue(today = todayIso()): { added: Transaction[]; undo: () => void } {
  const before = rules();
  const added: Transaction[] = [];
  for (const due of dueEntries(rules(), today)) {
    const value = dueEntryValue(due);
    if (!value) continue;
    added.push(useExpenseStore.getState().saveTransaction(value));
    advanceRule(due.rule.id, due.date);
  }
  const undo = () => {
    added.forEach((item) => useExpenseStore.getState().deleteTransaction(item.id));
    setRules(before);
  };
  return { added, undo };
}
