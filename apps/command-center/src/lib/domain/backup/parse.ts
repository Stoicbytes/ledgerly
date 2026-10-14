import { BackupError, FORBIDDEN_KEYS, isPlainObject, list, optional, record, text } from './guard';
import {
  accountCheck,
  categoryCheck,
  fundCheck,
  fundTxnCheck,
  goalCheck,
  noteCheck,
  personCheck,
  recurringCheck,
  sipCheck,
  stockCheck,
  tradeCheck,
  transactionCheck,
} from './records';
import { checkRules } from './rules';
import { employerCheck, payslipCheck, pfEntryCheck } from './salaryRecords';
import { siteCheck } from './site';
import { BACKUP_FORMAT, BACKUP_VERSION, MAX_BACKUP_BYTES, type Backup } from './types';

const MAX_ROWS = 100_000;
const some = <T>(check: Parameters<typeof list<T>>[0]) => list(check, MAX_ROWS);
const later = <T>(check: Parameters<typeof list<T>>[0]) =>
  optional(list(check, MAX_ROWS), undefined as T[] | undefined);

const dataCheck = record({
  accounts: some(accountCheck),
  categories: some(categoryCheck),
  people: some(personCheck),
  transactions: some(transactionCheck),
  notes: some(noteCheck),
  recurring: later(recurringCheck),
  goals: later(goalCheck),
  employers: later(employerCheck),
  payslips: later(payslipCheck),
  pfEntries: later(pfEntryCheck),
  funds: some(fundCheck),
  fundTransactions: some(fundTxnCheck),
  sips: some(sipCheck),
  stocks: some(stockCheck),
  stockTrades: some(tradeCheck),
  portfolioSite: siteCheck,
});

/** JSON.parse that refuses keys able to reach an object's prototype, at any depth. */
function readJson(raw: string): unknown {
  return JSON.parse(raw, (key, value: unknown) => {
    if (FORBIDDEN_KEYS.has(key)) throw new BackupError(`The file has a key named ${key}.`);
    return value;
  });
}

/**
 * Reads an "Export everything" file strictly: its size, format and version, every
 * field's type and limits, and the rules across records. Throws a BackupError with a
 * short reason when anything is off; nothing from a refused file is used.
 */
export function parseBackup(bytes: Uint8Array): Backup {
  if (bytes.byteLength > MAX_BACKUP_BYTES) {
    throw new BackupError('The file is larger than 20 MB, so it is not a Ledgerly backup.');
  }
  let json: unknown;
  try {
    json = readJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError('The file is not readable JSON.');
  }
  if (!isPlainObject(json) || json.format !== BACKUP_FORMAT) {
    throw new BackupError('This is not a Ledgerly "Export everything" file.');
  }
  if (typeof json.version !== 'number' || !Number.isInteger(json.version) || json.version < 1) {
    throw new BackupError('The file has no valid format version.');
  }
  if (json.version > BACKUP_VERSION) {
    throw new BackupError('The file was made by a newer version of Ledgerly. Update the app.');
  }
  const exportedAt = text(40)(json.exportedAt, 'exportedAt');
  if (!Number.isFinite(Date.parse(exportedAt))) throw new BackupError('exportedAt is not a time.');
  const raw = dataCheck(json.data, 'data');
  const data = {
    accounts: raw.accounts,
    categories: raw.categories,
    people: raw.people,
    // Receipt photos are not in the file: entries come back without them.
    transactions: raw.transactions.map(({ receipt: _receipt, ...entry }) => entry),
    notes: raw.notes,
    portfolio: {
      funds: raw.funds,
      fundTxns: raw.fundTransactions,
      sips: raw.sips,
      stocks: raw.stocks,
      trades: raw.stockTrades,
    },
    recurring: raw.recurring,
    goals: raw.goals,
    employers: raw.employers,
    payslips: raw.payslips,
    pfEntries: raw.pfEntries,
  };
  checkRules(data);
  return { exportedAt, data, site: raw.portfolioSite };
}
