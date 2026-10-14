import { getLedger, useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { currentSession } from '@/lib/data/rpc';
import { readPref, writePref } from '@/lib/device/prefs';
import { withoutImported } from '@/lib/domain/expenses';
import type { SheetImportPlan } from '@/lib/domain/expenses/sheetImports';

/**
 * The last import's created ids, kept on this device per signed-in user so "Undo last
 * import" survives a reload until it is used or dismissed. Only ids are kept (never
 * amounts, names or notes).
 */
export type LastImport = {
  at: string;
  transactions: string[];
  accounts: string[];
  categories: string[];
};

const ID = /^[0-9a-f-]{1,64}$/i;
const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 100_000 &&
  value.every((id) => typeof id === 'string' && ID.test(id));

/** The device key for the signed-in user, or null (preview, or no session). */
export async function lastImportKey(): Promise<string | null> {
  try {
    return `ledgerly.lastImport.${(await currentSession()).userId}`;
  } catch {
    return null;
  }
}

export async function readLastImport(key: string): Promise<LastImport | null> {
  try {
    const value = JSON.parse((await readPref(key)) ?? 'null') as Record<string, unknown> | null;
    if (!value || typeof value.at !== 'string') return null;
    const { transactions, accounts, categories } = value;
    if (!isIds(transactions) || !isIds(accounts) || !isIds(categories)) return null;
    return { at: value.at, transactions, accounts, categories };
  } catch {
    return null;
  }
}

export const lastImportOf = (plan: SheetImportPlan, now = new Date()): LastImport => ({
  at: now.toISOString(),
  transactions: plan.transactions.map((item) => item.id),
  accounts: plan.accounts.map((item) => item.id),
  categories: plan.categories.map((item) => item.id),
});

export const saveLastImport = (key: string, last: LastImport) =>
  writePref(key, JSON.stringify(last));

export const clearLastImport = (key: string) => writePref(key, null);

/**
 * Takes the import back as it is now: entries already deleted are skipped, and accounts
 * and categories that something else uses stay (the import's own undo rules). Returns
 * how many entries were removed.
 */
export function undoLastImport(last: LastImport): number {
  const ledger = getLedger();
  const pick = <T extends { id: string }>(items: T[], ids: string[]) => {
    const wanted = new Set(ids);
    return items.filter((item) => wanted.has(item.id));
  };
  const imported = {
    transactions: pick(ledger.transactions, last.transactions),
    accounts: pick(ledger.accounts, last.accounts),
    categories: pick(ledger.categories, last.categories),
  };
  const { rules } = useRecurringStore.getState();
  useExpenseStore.getState().restoreLedger(withoutImported(ledger, imported, rules));
  return imported.transactions.length;
}
