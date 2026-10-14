import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { planSheetImport, readExpenseSheet } from '@/lib/domain/expenses/sheetImports';
import { reviewLines } from '../SheetImportCard';

const sheet = [
  ['Period', 'Accounts', 'Category', 'Subcategory', 'Note', 'Amount', 'Income/Expense'],
  [46248.45, 'Old bank', 'Food', 'Tea', 'Canteen', 15, 'Exp.'],
  [46249.5, 'Old bank', 'Pocket money', '', '', 2000, 'Income'],
  [46249.6, 'Old bank', 'Modified Bal.', '', '', 900, 'Income Balance'],
];

describe('importing from another app', () => {
  beforeEach(() => useExpenseStore.getState().resetPreview());

  it('describes the import before anything is added', () => {
    const before = useExpenseStore.getState().transactions.length;
    let n = 0;
    const plan = planSheetImport(
      readExpenseSheet(sheet),
      useExpenseStore.getState(),
      () => `imp-${(n += 1)}`,
    );
    const lines = reviewLines(plan);
    expect(lines[0]).toMatch(
      /^2 entries from 14 Aug 2026 to 15 Aug 2026: ₹15 spent, ₹2,000 income\.$/,
    );
    expect(lines).toContain('New accounts: Old bank (Bank account).');
    expect(lines).toContain('Opening balances from balance corrections: Old bank ₹900.');
    expect(useExpenseStore.getState().transactions).toHaveLength(before);
  });

  it('adds everything at once and can take it all back', () => {
    const store = useExpenseStore.getState();
    const before = store.transactions.length;
    let n = 0;
    const plan = planSheetImport(readExpenseSheet(sheet), store, () => `imp-${(n += 1)}`);
    const previous = store.addImported(plan);
    const after = useExpenseStore.getState();
    expect(after.transactions).toHaveLength(before + 2);
    expect(after.accounts.some((item) => item.name === 'Old bank')).toBe(true);
    expect(after.categories.some((item) => item.name === 'Pocket money')).toBe(true);
    useExpenseStore.getState().restoreLedger(previous);
    expect(useExpenseStore.getState().transactions).toHaveLength(before);
    expect(useExpenseStore.getState().accounts.some((item) => item.name === 'Old bank')).toBe(
      false,
    );
  });

  it('adds nothing when the same plan is approved twice', () => {
    let n = 0;
    const read = readExpenseSheet(sheet);
    const first = planSheetImport(read, useExpenseStore.getState(), () => `a-${(n += 1)}`);
    useExpenseStore.getState().addImported(first);
    // approving plans again against the ledger as it is now
    const second = planSheetImport(read, useExpenseStore.getState(), () => `b-${(n += 1)}`);
    expect(second.transactions).toEqual([]);
    expect(second.accounts).toEqual([]);
    expect(second.categories).toEqual([]);
  });
});
