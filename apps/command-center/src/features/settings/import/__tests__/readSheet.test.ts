import { readSheet } from '../useSheetImport';

describe('reading a chosen file', () => {
  it('explains old .xls files and files that are not spreadsheets', async () => {
    expect((await readSheet('export.xls', new Uint8Array([1]))).problems[0]).toMatch(
      /save it as \.xlsx or \.csv/,
    );
    expect((await readSheet('export.xlsx', new Uint8Array([1, 2, 3]))).problems[0]).toMatch(
      /not an \.xlsx/,
    );
  });

  it('reads a CSV export', async () => {
    const csv =
      'Period,Accounts,Category,Note,Amount,Income/Expense\n14/08/2026,Cash,Food,Tea,"1,015",Exp.\n';
    const read = await readSheet('export.csv', new TextEncoder().encode(csv));
    expect(read.rows[0]).toMatchObject({ date: '2026-08-14', amount: 1_015_00, account: 'Cash' });
  });
});
