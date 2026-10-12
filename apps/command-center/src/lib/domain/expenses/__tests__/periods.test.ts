import {
  calendarMonth,
  comparisonRange,
  groupByDay,
  monthlySeries,
  percentChange,
  periodTotals,
  weekSummaries,
  yearSummary,
} from '../periods';
import { october, transactions } from '../__fixtures__/ledger';

describe('periodTotals', () => {
  it('excludes transfers but counts their fee as an expense', () => {
    expect(periodTotals(transactions, october)).toEqual({
      income: 8_000_000,
      expense: 1_046_000,
      net: 6_954_000,
    });
  });

  it('filters to one account (its own income and spending, including fees it paid)', () => {
    expect(periodTotals(transactions, october, 'bank')).toEqual({
      income: 8_000_000,
      expense: 1_011_000,
      net: 6_989_000,
    });
    expect(periodTotals(transactions, october, 'card')).toEqual({
      income: 0,
      expense: 5_000,
      net: -5_000,
    });
  });
});

describe('grouping', () => {
  it('groups by day, newest first, with items newest first', () => {
    const days = groupByDay(transactions, october);
    expect(days.map((day) => day.date)).toEqual([
      '2026-10-10',
      '2026-10-05',
      '2026-10-03',
      '2026-10-02',
      '2026-10-01',
    ]);
    expect(days[2].items.map((item) => item.id)).toEqual(['t4', 't3']);
    expect(days[2].expense).toBe(35_000);
  });

  it('shows transfers touching a filtered account without counting them as its spending', () => {
    const days = groupByDay(transactions, october, 'card');
    expect(days.map((day) => day.date)).toEqual(['2026-10-10', '2026-10-03']);
    expect(days[0].expense).toBe(0);
  });

  it('builds calendar cells with per-day totals', () => {
    const weeks = calendarMonth('2026-10', transactions);
    const cells = weeks.flat();
    expect(cells.find((cell) => cell.date === '2026-10-03')).toMatchObject({
      expense: 35_000,
      count: 2,
      inMonth: true,
    });
    expect(cells.find((cell) => cell.date === '2026-09-28')).toMatchObject({
      inMonth: false,
      expense: 4_000,
    });
  });

  it('summarises months and weeks consistently', () => {
    const year = yearSummary(2026, transactions);
    expect(year).toHaveLength(12);
    expect(year[9]).toMatchObject({ month: '2026-10', income: 8_000_000, expense: 1_046_000 });
    expect(year[8].expense).toBe(4_000);
    const weeks = weekSummaries('2026-10', transactions);
    expect(weeks.reduce((sum, week) => sum + week.expense, 0)).toBe(1_046_000);
    expect(monthlySeries('2026-10', 2, transactions).map((item) => item.month)).toEqual([
      '2026-09',
      '2026-10',
    ]);
  });
});

describe('percentChange', () => {
  it('returns null without a base', () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(-50, -100)).toBe(50);
  });
});

describe('comparisonRange', () => {
  it('compares a month in progress with the same days of the previous month', () => {
    expect(comparisonRange('2026-10', '2026-10-07')).toEqual({
      start: '2026-09-01',
      end: '2026-09-07',
    });
  });

  it('clips to the end of a shorter previous month', () => {
    expect(comparisonRange('2026-03', '2026-03-31')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('compares finished months whole', () => {
    expect(comparisonRange('2026-09', '2026-10-07')).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    });
  });
});
