import { accounts, categories, transactions } from '../__fixtures__/ledger';
import { csvCell, transactionsCsv } from '../csv';

const context = { accounts, categories, people: [{ id: 'ravi', name: 'Ravi', order: 0 }] };

describe('CSV export', () => {
  it('writes a header and one row per entry, oldest first, in rupees', () => {
    const csv = transactionsCsv(transactions.slice(0, 5), context);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe(
      'Date,Type,Amount,My share,Category,Subcategory,Account,To account,Transfer fee,Shared with,Paid back by,Note',
    );
    expect(lines).toHaveLength(6);
    expect(lines[1]).toBe('2026-10-01,Income,80000.00,80000.00,Salary,,Bank,,,,,');
    expect(lines[3]).toBe('2026-10-03,Expense,50.00,50.00,Food,Tea,Card,,,,,Tea');
    expect(lines[5]).toBe('2026-10-10,Transfer,2000.00,,,,Bank,Card,10.00,,,');
  });

  it('lists shares and repayments', () => {
    const csv = transactionsCsv(
      [
        { ...transactions[3], splits: [{ personId: 'ravi', amount: 10_000 }] },
        {
          ...transactions[0],
          id: 'r1',
          amount: 10_000,
          categoryId: null,
          personId: 'ravi',
          note: 'Paid back',
        },
      ],
      context,
    );
    expect(csv).toContain('Expense,300.00,200.00,Food,,Cash,,,Ravi 100.00,,Lunch');
    expect(csv).toContain('Repayment,100.00,0.00,,,Bank,,,,Ravi,Paid back');
  });

  it('quotes commas and quotes, and never lets a note become a formula', () => {
    expect(csvCell('Tea, snacks')).toBe('"Tea, snacks"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+91 call')).toBe("'+91 call");
    expect(csvCell('-5 refund')).toBe("'-5 refund");
    expect(csvCell('@sum')).toBe("'@sum");
    expect(csvCell('plain')).toBe('plain');
  });
});
