import type { Account, Category, Person, RecurringEntry, Transaction } from '@/lib/domain/expenses';
import type { Goal, Portfolio } from '@/lib/domain/investments';
import type { Note } from '@/lib/domain/notes';
import type { Employer, Payslip, PfEntry } from '@/lib/domain/salary';
import type { SiteData } from '@/lib/domain/site';

/**
 * Everything a backup can hold, in the app's own types (the same shape the cloud data
 * has). Lists from later migrations are undefined when the file or the database has none.
 */
export type LedgerData = {
  accounts: Account[];
  categories: Category[];
  people: Person[];
  transactions: Transaction[];
  notes: Note[];
  portfolio: Portfolio;
  recurring?: RecurringEntry[];
  goals?: Goal[];
  employers?: Employer[];
  payslips?: Payslip[];
  pfEntries?: PfEntry[];
};

export type Backup = {
  /** When the file was made (ISO time). */
  exportedAt: string;
  data: LedgerData;
  /** The portfolio site's content (files and images excluded), or null. */
  site: SiteData | null;
};

/** The file "Export everything" writes; restore reads this format and version only. */
export const BACKUP_FORMAT = 'ledgerly-export';
export const BACKUP_VERSION = 1;
/** Larger files are refused before they are read. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
