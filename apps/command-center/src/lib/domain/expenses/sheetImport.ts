import { dayFirst, readWhen } from './sheetDates';
import type { CategoryKind } from './types';
import { MAX_NOTE_LENGTH } from './validation';

/**
 * Entries exported from another expense app as a spreadsheet with the columns Period,
 * Accounts, Category, Subcategory, Note, Description, Amount and Income/Expense (the
 * layout Money Manager and similar apps export). The file is read on this device only;
 * sheetImportPlan.ts compares the rows with your ledger and you approve what is added.
 */
type Cell = string | number | boolean | null;

export type SheetRow = {
  /** Row number in the file, for messages. */
  line: number;
  date: string;
  /** Milliseconds, keeps entries of one day in their original order. */
  at: number;
  /** balance: a balance correction ("Modified Bal.") of `direction` × amount. */
  kind: CategoryKind | 'transfer' | 'balance';
  account: string;
  /** Transfers: the receiving account (Money Manager puts it in the Category column). */
  toAccount: string;
  /** Transfers: 'in' rows mirror an 'out' row of the same transfer. Balance: +1 or -1. */
  side: 'out' | 'in' | null;
  direction: 1 | -1;
  category: string;
  subcategory: string;
  note: string;
  /** Paise, > 0. */
  amount: number;
};

export type SheetRead = {
  rows: SheetRow[];
  /** Rows that are not imported, and why. */
  skipped: { line: number; reason: string }[];
  /** Why the file could not be read at all (empty when it could). */
  problems: string[];
};

const REQUIRED = ['period', 'accounts', 'category', 'amount', 'income/expense'] as const;

export const SKIP_REASONS = {
  type: 'The type is not income, expense, transfer or a balance correction.',
  transfer: 'The transfer does not name two different accounts (the other one goes in Category).',
  balance:
    'Balance corrections only set the opening balance of accounts this import creates: set an existing account in Accounts.',
  date: 'The date could not be read.',
  amount: 'The amount is zero, negative or could not be read.',
} as const;

const text = (cell: Cell | undefined) =>
  cell === null || cell === undefined ? '' : String(cell).trim();

/** "₹1,234.50", "1,234.50 INR" or a number → paise; NaN when it is not an amount. */
export function readAmount(cell: Cell | undefined): number {
  if (typeof cell === 'number') return Math.round(cell * 100);
  const value = text(cell).replace(/[^0-9.-]/g, '');
  return /^-?\d*\.?\d+$/.test(value) ? Math.round(Number(value) * 100) : NaN;
}

type Kind = Pick<SheetRow, 'kind' | 'side' | 'direction'>;

function readKind(value: string): Kind | null {
  const kind = value.toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ');
  if (kind === 'exp' || kind === 'expense' || kind === 'expenses') {
    return { kind: 'expense', side: null, direction: 1 };
  }
  if (kind === 'income') return { kind: 'income', side: null, direction: 1 };
  if (kind.startsWith('transfer')) {
    return { kind: 'transfer', side: /in$/.test(kind) ? 'in' : 'out', direction: 1 };
  }
  if (kind.endsWith('balance')) {
    return { kind: 'balance', side: null, direction: kind.startsWith('exp') ? -1 : 1 };
  }
  return null;
}

/** One note from the short note and the longer description, within the note limit. */
export function joinNote(note: string, description: string): string {
  let joined = note;
  if (!note) joined = description;
  else if (description && description !== note)
    joined = description.startsWith(note) ? description : `${note} · ${description}`;
  return joined.length > MAX_NOTE_LENGTH ? `${joined.slice(0, MAX_NOTE_LENGTH - 1)}…` : joined;
}

/** Reads the first sheet's rows. */
export function readExpenseSheet(rows: Cell[][]): SheetRead {
  const headerAt = rows.findIndex((row) => {
    const names = row.map((cell) => text(cell).toLowerCase());
    return REQUIRED.every((name) => names.includes(name));
  });
  if (headerAt < 0) {
    return {
      rows: [],
      skipped: [],
      problems: [
        'This file does not look like an expense export: it needs the columns Period, Accounts, Category, Amount and Income/Expense.',
      ],
    };
  }
  const names = rows[headerAt].map((cell) => text(cell).toLowerCase());
  const col = (name: string) => names.indexOf(name);
  const read: SheetRead = { rows: [], skipped: [], problems: [] };
  const body = rows.slice(headerAt + 1);
  const isDayFirst = dayFirst(body.map((row) => row[col('period')]));
  body.forEach((row, index) => {
    const line = headerAt + index + 2;
    if (row.every((cell) => text(cell) === '')) return;
    const kind = readKind(text(row[col('income/expense')]));
    if (!kind) return void read.skipped.push({ line, reason: SKIP_REASONS.type });
    const when = readWhen(row[col('period')], isDayFirst);
    if (!when) return void read.skipped.push({ line, reason: SKIP_REASONS.date });
    const amount = readAmount(row[col('amount')]);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
      read.skipped.push({ line, reason: SKIP_REASONS.amount });
      return;
    }
    let account = text(row[col('accounts')]) || 'Imported';
    let toAccount = '';
    if (kind.kind === 'transfer') {
      // Out: from Accounts to Category. In: the same transfer seen from the other side.
      const other = text(row[col('category')]);
      [account, toAccount] = kind.side === 'in' ? [other, account] : [account, other];
      if (!account || !toAccount || account.toLowerCase() === toAccount.toLowerCase()) {
        return void read.skipped.push({ line, reason: SKIP_REASONS.transfer });
      }
    }
    const plain = kind.kind === 'expense' || kind.kind === 'income';
    read.rows.push({
      line,
      ...when,
      ...kind,
      account,
      toAccount,
      category: plain ? text(row[col('category')]) : '',
      subcategory: plain && col('subcategory') >= 0 ? text(row[col('subcategory')]) : '',
      note: joinNote(
        col('note') >= 0 ? text(row[col('note')]) : '',
        col('description') >= 0 ? text(row[col('description')]) : '',
      ),
      amount,
    });
  });
  return read;
}
