import type { DayGroup } from '@/lib/domain/expenses';
import { firstRows } from '../DailyView';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: () => null }));

const day = (date: string, count: number) =>
  ({
    date,
    income: 0,
    expense: 0,
    items: Array.from({ length: count }, (_, index) => ({ id: `${date}-${index}` })),
  }) as unknown as DayGroup;

describe('firstRows', () => {
  it('keeps whole days until the limit, then cuts the last day short', () => {
    const shown = firstRows([day('2026-10-14', 3), day('2026-10-13', 4), day('2026-10-12', 2)], 5);
    expect(shown.map((group) => group.items.length)).toEqual([3, 2]);
    expect(shown[1].date).toBe('2026-10-13');
  });

  it('shows everything when the limit is not reached', () => {
    expect(firstRows([day('2026-10-14', 2)], 40)[0].items).toHaveLength(2);
  });
});
