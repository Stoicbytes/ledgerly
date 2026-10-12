import {
  addDays,
  addMonths,
  calendarWeeks,
  daysInMonth,
  isValidIsoDate,
  monthBounds,
  weekdayIndex,
  weeksOfMonth,
} from '../dates';

describe('date helpers', () => {
  it('validates real calendar dates only', () => {
    expect(isValidIsoDate('2026-10-07')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-1-7')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('moves across month and year boundaries', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('knows month lengths including leap years', () => {
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(monthBounds('2026-10')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  });

  it('builds Monday-first calendar weeks covering the month', () => {
    const weeks = calendarWeeks('2026-10'); // 1 Oct 2026 is a Thursday
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toBe('2026-09-28');
    expect(weeks[4][6]).toBe('2026-11-01');
    expect(weekdayIndex('2026-10-01')).toBe(3);
  });

  it('clips week ranges to the month', () => {
    const weeks = weeksOfMonth('2026-10');
    expect(weeks[0]).toEqual({ start: '2026-10-01', end: '2026-10-04' });
    expect(weeks[4]).toEqual({ start: '2026-10-26', end: '2026-10-31' });
  });
});
