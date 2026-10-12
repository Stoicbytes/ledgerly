import { dueDates, dueEntries, followingDate, type RecurringEntry } from '../recurring';

const rule = (patch: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'r',
  kind: 'expense',
  amount: 100,
  accountId: 'cash',
  toAccountId: null,
  fee: 0,
  categoryId: 'rent',
  note: '',
  frequency: 'monthly',
  startDate: '2026-01-31',
  nextDate: '2026-01-31',
  createdAt: 0,
  ...patch,
});

describe('recurring dates', () => {
  it('keeps the day of the month, using the last day of shorter months', () => {
    const r = rule({});
    expect(followingDate(r, '2026-01-31')).toBe('2026-02-28');
    expect(followingDate(r, '2026-02-28')).toBe('2026-03-31');
    expect(followingDate(r, '2026-04-15')).toBe('2026-04-30');
    expect(followingDate(rule({ startDate: '2027-12-31' }), '2027-12-31')).toBe('2028-01-31');
  });

  it('handles days, weeks, leap years and dates before the start', () => {
    expect(followingDate(rule({ frequency: 'daily' }), '2026-02-28')).toBe('2026-03-01');
    const weekly = rule({ frequency: 'weekly', startDate: '2026-10-05' });
    expect(followingDate(weekly, '2026-10-05')).toBe('2026-10-12');
    expect(followingDate(weekly, '2026-10-09')).toBe('2026-10-12');
    expect(followingDate(weekly, '2026-10-01')).toBe('2026-10-05');
    const leap = rule({ frequency: 'yearly', startDate: '2028-02-29' });
    expect(followingDate(leap, '2028-02-29')).toBe('2029-02-28');
    expect(followingDate(leap, '2029-02-28')).toBe('2030-02-28');
    expect(followingDate(leap, '2031-03-01')).toBe('2032-02-29');
  });

  it('lists what is due up to today, oldest first, with a limit', () => {
    const r = rule({ startDate: '2026-08-05', nextDate: '2026-08-05' });
    expect(dueDates(r, '2026-10-11')).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
    expect(dueDates(r, '2026-08-04')).toEqual([]);
    expect(
      dueDates(rule({ frequency: 'daily', nextDate: '2026-01-01' }), '2026-12-31'),
    ).toHaveLength(12);
    const both = dueEntries(
      [r, rule({ id: 'w', frequency: 'weekly', startDate: '2026-10-01', nextDate: '2026-10-08' })],
      '2026-10-11',
    );
    expect(both.map((item) => `${item.rule.id} ${item.date}`)).toEqual([
      'r 2026-08-05',
      'r 2026-09-05',
      'r 2026-10-05',
      'w 2026-10-08',
    ]);
  });
});
