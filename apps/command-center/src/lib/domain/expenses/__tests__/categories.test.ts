import { budgetStatus, dailyAllowance } from '../budgets';
import {
  OTHER_ID,
  TRANSFER_FEES_ID,
  UNCATEGORIZED_ID,
  categoryBreakdown,
  categoryPath,
  categoryTrend,
  entryCounts,
  limitSlices,
  resolveCategory,
  searchCategories,
  subcategoryBreakdown,
} from '../index';
import { periodTotals } from '../periods';
import { categories, october, transactions } from '../__fixtures__/ledger';

describe('category breakdowns', () => {
  it('sums exactly to the period expense total, with fees and uncategorised buckets', () => {
    const slices = categoryBreakdown(transactions, categories, 'expense', october);
    expect(slices.map((slice) => [slice.id, slice.amount])).toEqual([
      ['rent', 1_000_000],
      ['food', 35_000],
      [UNCATEGORIZED_ID, 10_000],
      [TRANSFER_FEES_ID, 1_000],
    ]);
    const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
    expect(total).toBe(periodTotals(transactions, october).expense);
    expect(slices[0].share).toBeCloseTo(1_000_000 / 1_046_000);
  });

  it('splits a category into subcategories plus a general bucket', () => {
    const slices = subcategoryBreakdown(transactions, categories, 'food', october);
    expect(slices.map((slice) => [slice.name, slice.amount])).toEqual([
      ['Food (general)', 30_000],
      ['Tea', 5_000],
    ]);
  });

  it('resolves leaf ids to parent and subcategory', () => {
    expect(resolveCategory(categories, 'tea').parent?.id).toBe('food');
    expect(categoryPath(categories, 'tea')).toBe('Food › Tea');
    expect(categoryPath(categories, 'rent')).toBe('Rent');
    expect(categoryPath(categories, null)).toBeNull();
  });

  it('builds a monthly trend for one category', () => {
    expect(categoryTrend(transactions, categories, 'food', '2026-10', 2)).toEqual([
      { month: '2026-09', amount: 4_000 },
      { month: '2026-10', amount: 35_000 },
    ]);
    // Only the card's tea purchases remain when filtering to the card.
    expect(categoryTrend(transactions, categories, 'food', '2026-10', 2, 'card')).toEqual([
      { month: '2026-09', amount: 4_000 },
      { month: '2026-10', amount: 5_000 },
    ]);
  });

  it('narrows the trend to one subcategory slice', () => {
    // Tea only (t6 in September, t3 in October).
    expect(categoryTrend(transactions, categories, 'food', '2026-10', 2, null, 'tea')).toEqual([
      { month: '2026-09', amount: 4_000 },
      { month: '2026-10', amount: 5_000 },
    ]);
    // The parent's own id is the "(general)" slice: entries filed directly under Food.
    expect(categoryTrend(transactions, categories, 'food', '2026-10', 2, null, 'food')).toEqual([
      { month: '2026-09', amount: 0 },
      { month: '2026-10', amount: 30_000 },
    ]);
  });

  it('counts entries per category, parents including their subcategories', () => {
    const counts = entryCounts(transactions, categories);
    // food: t4 + tea's t3 and t6; tea: t3, t6; rent: t2; salary: t1; transfers ignored.
    expect(Object.fromEntries(counts)).toEqual({ food: 3, tea: 2, rent: 1, salary: 1 });
  });

  it('searches categories and subcategories of one kind', () => {
    const ids = (query: string) =>
      searchCategories(categories, 'expense', query).map((category) => category.id);
    expect(ids('t')).toEqual(['rent', 'gift', 'tea']);
    expect(ids('  TEA ')).toEqual(['tea']);
    expect(ids('salary')).toEqual([]);
    expect(ids('')).toEqual([]);
  });

  it('folds the smallest slices into Other', () => {
    const slices = categoryBreakdown(transactions, categories, 'expense', october);
    expect(limitSlices(slices, 4)).toBe(slices);
    const limited = limitSlices(slices, 3);
    expect(limited.map((slice) => [slice.id, slice.amount, slice.count])).toEqual([
      ['rent', 1_000_000, 1],
      ['food', 35_000, 2],
      [OTHER_ID, 11_000, 2],
    ]);
    expect(limited[2].name).toBe('Other (2)');
    expect(limited.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1);
  });
});

describe('budgets', () => {
  it('reports budget lines sorted by how much is used', () => {
    const status = budgetStatus(categories, transactions, '2026-10');
    expect(status.lines.map((line) => [line.category.id, line.spent, line.remaining])).toEqual([
      ['rent', 1_000_000, 0],
      ['food', 35_000, 465_000],
    ]);
    expect(status.totalBudget).toBe(1_500_000);
    expect(status.remaining).toBe(465_000);
    expect(status.unbudgeted.map((item) => item.category.id)).toEqual(['gift']);
  });

  it('computes a daily allowance only when money is left', () => {
    expect(dailyAllowance(465_000, 10)).toBe(46_500);
    expect(dailyAllowance(0, 10)).toBeNull();
    expect(dailyAllowance(100, 0)).toBeNull();
  });
});
