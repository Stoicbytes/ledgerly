import { planSheetImport, readAmount, readExpenseSheet, SKIP_REASONS } from '..';

describe('amounts with a currency word', () => {
  it('strips ₹, Rs, Rs. and INR before reading the number', () => {
    expect(readAmount('Rs.500')).toBe(500_00);
    expect(readAmount('Rs. 1,500.00')).toBe(1_500_00);
    expect(readAmount('INR 500')).toBe(500_00);
    expect(readAmount('inr1,23,456.5')).toBe(1_23_456_50);
    expect(readAmount('rs 75')).toBe(75_00);
    expect(readAmount('₹ 2,000')).toBe(2_000_00);
    expect(readAmount('Rs. 500/-')).toBe(500_00);
    expect(readAmount('-₹50')).toBe(-50_00);
  });

  it('refuses European decimals instead of guessing', () => {
    expect(readAmount('1.234,50')).toBeNaN();
    expect(readAmount('12,5')).toBeNaN();
    expect(readAmount('Rs 5 00')).toBeNaN();
  });
});

describe('a transfer to the same account', () => {
  it('skips it when the names only differ by emoji', () => {
    const header = ['Period', 'Accounts', 'Category', 'Note', 'Amount', 'Income/Expense'];
    const read = readExpenseSheet([
      header,
      ['2026-08-14', 'HDFC', 'HDFC 💳', 'Move', 500, 'Transfer-Out'],
      ['2026-08-14', 'HDFC', 'Cash', 'ATM', 500, 'Transfer-Out'],
    ]);
    let n = 0;
    const plan = planSheetImport(
      read,
      { accounts: [], categories: [], transactions: [] },
      () => `id${(n += 1)}`,
    );
    expect(plan.transactions).toHaveLength(1);
    expect(plan.transactions.every((item) => item.accountId !== item.toAccountId)).toBe(true);
    expect(plan.skipped).toEqual([{ line: 2, reason: SKIP_REASONS.sameAccount }]);
  });

  it('keeps notes up to the database limit of 500 characters', () => {
    const header = ['Period', 'Accounts', 'Category', 'Note', 'Amount', 'Income/Expense'];
    const read = readExpenseSheet([
      header,
      ['2026-08-14', 'Bank', 'Food', 'x'.repeat(300), 5, 'Exp.'],
    ]);
    expect(read.rows[0].note).toHaveLength(300);
  });
});
