import type { TransactionKind } from '@/lib/domain/expenses';
import { readPref, writePref } from '@/lib/device/prefs';

/**
 * The last entry type and the account last used for each type, kept on this device so the
 * next new entry starts there (ids only: no amounts or names).
 */
export type LastEntry = {
  kind: TransactionKind;
  accounts: Partial<Record<TransactionKind, string>>;
};

const KEY = 'cc.lastEntry';
const KINDS: TransactionKind[] = ['expense', 'income', 'transfer'];

export const NO_LAST_ENTRY: LastEntry = { kind: 'expense', accounts: {} };

export function parseLastEntry(raw: string | null): LastEntry {
  try {
    const value = JSON.parse(raw ?? '') as { kind?: unknown; accounts?: Record<string, unknown> };
    const kind = KINDS.find((item) => item === value.kind) ?? 'expense';
    const accounts: LastEntry['accounts'] = {};
    for (const item of KINDS) {
      const id = value.accounts?.[item];
      if (typeof id === 'string' && id.length <= 64) accounts[item] = id;
    }
    return { kind, accounts };
  } catch {
    return NO_LAST_ENTRY;
  }
}

export const readLastEntry = async () => parseLastEntry(await readPref(KEY));

export const saveLastEntry = (last: LastEntry) => void writePref(KEY, JSON.stringify(last));
