import { tradeDate } from '../investments/tradebook';
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
  kind: CategoryKind;
  account: string;
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
const DAY = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export const SKIP_REASONS = {
  balance: 'Balance corrections are left out: set the account balance in Accounts instead.',
  transfer: 'Transfers are left out: add them as transfers by hand.',
  type: 'The type is not income or expense.',
  date: 'The date could not be read.',
  amount: 'The amount is zero or could not be read.',
} as const;

const text = (cell: Cell | undefined) =>
  cell === null || cell === undefined ? '' : String(cell).trim();

/** A date cell: an Excel serial (the time of day kept) or text such as 2026-08-14 10:49. */
function readWhen(cell: Cell | undefined): { date: string; at: number } | null {
  if (typeof cell === 'number' && cell > 20000 && cell < 80000) {
    const at = EXCEL_EPOCH + Math.round(cell * DAY);
    return { date: new Date(Math.floor(at / DAY) * DAY).toISOString().slice(0, 10), at };
  }
  const date = tradeDate(cell);
  return date ? { date, at: Date.parse(`${date}T00:00:00Z`) } : null;
}

function readKind(value: string): CategoryKind | keyof typeof SKIP_REASONS {
  const kind = value.toLowerCase().replace(/\.$/, '');
  if (kind === 'exp' || kind === 'expense' || kind === 'expenses') return 'expense';
  if (kind === 'income') return 'income';
  if (kind.endsWith('balance')) return 'balance';
  if (kind.startsWith('transfer')) return 'transfer';
  return 'type';
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
  rows.slice(headerAt + 1).forEach((row, index) => {
    const line = headerAt + index + 2;
    if (row.every((cell) => text(cell) === '')) return;
    const kind = readKind(text(row[col('income/expense')]));
    if (kind !== 'expense' && kind !== 'income') {
      read.skipped.push({ line, reason: SKIP_REASONS[kind] });
      return;
    }
    const when = readWhen(row[col('period')]);
    if (!when) return void read.skipped.push({ line, reason: SKIP_REASONS.date });
    const cell = row[col('amount')];
    const value = typeof cell === 'number' ? cell : Number(text(cell).replace(/,/g, ''));
    const amount = Math.round(value * 100);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
      read.skipped.push({ line, reason: SKIP_REASONS.amount });
      return;
    }
    read.rows.push({
      line,
      ...when,
      kind,
      account: text(row[col('accounts')]) || 'Imported',
      category: text(row[col('category')]),
      subcategory: col('subcategory') >= 0 ? text(row[col('subcategory')]) : '',
      note: joinNote(
        col('note') >= 0 ? text(row[col('note')]) : '',
        col('description') >= 0 ? text(row[col('description')]) : '',
      ),
      amount,
    });
  });
  return read;
}
