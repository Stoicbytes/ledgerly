import { resolveCategory } from './categories';
import { isRepayment, ownShare, splitTotal } from './people';
import type { Account, Category, Person, Transaction } from './types';

const HEADER = [
  'Date',
  'Type',
  'Amount',
  'My share',
  'Category',
  'Subcategory',
  'Account',
  'To account',
  'Transfer fee',
  'Shared with',
  'Paid back by',
  'Note',
];

const rupees = (paise: number) => (paise / 100).toFixed(2);

/**
 * One spreadsheet cell. Text a spreadsheet would run as a formula (starting with = + - @
 * or a tab) gets a leading apostrophe, so a note can never become a formula when the
 * file is opened in Excel or Sheets.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

type Context = { accounts: Account[]; categories: Category[]; people: Person[] };

/** The entries as CSV (UTF-8 with a byte-order mark, so Excel shows ₹ and names correctly). */
export function transactionsCsv(transactions: Transaction[], context: Context): string {
  const account = new Map(context.accounts.map((a) => [a.id, a.name]));
  const person = new Map(context.people.map((p) => [p.id, p.name]));
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((t) => {
      const { parent, sub } = resolveCategory(context.categories, t.categoryId);
      const type = isRepayment(t)
        ? 'Repayment'
        : { expense: 'Expense', income: 'Income', transfer: 'Transfer' }[t.kind];
      const cells = [
        t.date,
        type,
        rupees(t.amount),
        t.kind === 'transfer' ? '' : rupees(ownShare(t)),
        parent?.name ?? '',
        sub?.name ?? '',
        account.get(t.accountId) ?? '',
        t.toAccountId ? (account.get(t.toAccountId) ?? '') : '',
        t.fee ? rupees(t.fee) : '',
        splitTotal(t)
          ? (t.splits ?? [])
              .map((s) => `${person.get(s.personId) ?? '?'} ${rupees(s.amount)}`)
              .join('; ')
          : '',
        t.personId ? (person.get(t.personId) ?? '') : '',
        t.note,
      ];
      return cells.map(csvCell).join(',');
    });
  return `﻿${[HEADER.join(','), ...rows].join('\r\n')}\r\n`;
}
