import { compareWithIndex, navInForce } from '../benchmark';
import type { Series } from '../types';

const history: Series = [
  ['2024-01-01', 100],
  ['2024-06-03', 110],
  ['2025-01-01', 120],
  ['2025-06-02', 150],
];

describe('navInForce', () => {
  it('uses the last NAV on or up to 10 days before the date', () => {
    expect(navInForce(history, '2024-06-03')).toBe(110);
    expect(navInForce(history, '2024-06-10')).toBe(110);
    expect(navInForce(history, '2024-07-01')).toBeNull();
    expect(navInForce(history, '2023-12-31')).toBeNull();
  });
});

describe('compareWithIndex', () => {
  it('puts each buy into the fund at that day’s NAV and values it at the latest', () => {
    const result = compareWithIndex(
      [
        { date: '2024-01-01', amount: -1_000_000 },
        { date: '2025-01-01', amount: -1_200_000 },
      ],
      2_500_000,
      history,
      '2025-06-05',
    );
    // 10,000 + 10,000 units × 150
    expect(result).toMatchObject({
      status: 'ok',
      indexValue: 3_000_000,
      yourValue: 2_500_000,
      invested: 2_200_000,
      withdrawn: 0,
      navDate: '2025-06-02',
      exhausted: false,
    });
    if (result.status !== 'ok') throw new Error();
    expect(result.indexXirr).toBeGreaterThan(result.yourXirr ?? Infinity);
  });

  it('takes sales and dividends out of the fund holding', () => {
    const result = compareWithIndex(
      [
        { date: '2024-01-01', amount: -1_000_000 },
        { date: '2025-01-01', amount: 600_000 },
      ],
      0,
      history,
      '2025-06-05',
    );
    // 10,000 units − 5,000 units at 120 → 5,000 × 150
    expect(result).toMatchObject({ status: 'ok', indexValue: 750_000, withdrawn: 600_000 });
  });

  it('counts the fund holding as zero when a sale takes out more than it has', () => {
    const result = compareWithIndex(
      [
        { date: '2024-01-01', amount: -1_000_000 },
        { date: '2025-01-01', amount: 3_000_000 },
      ],
      0,
      history,
      '2025-06-05',
    );
    expect(result).toMatchObject({ status: 'ok', indexValue: 0, exhausted: true });
  });

  it('needs NAV history from the first trade', () => {
    expect(
      compareWithIndex([{ date: '2023-05-01', amount: -100 }], 100, history, '2025-06-05'),
    ).toEqual({ status: 'noHistory', firstNavDate: '2024-01-01', firstTradeDate: '2023-05-01' });
    expect(compareWithIndex([{ date: '2024-01-01', amount: -100 }], 100, [], '2025-06-05')).toEqual(
      { status: 'noHistory', firstNavDate: null, firstTradeDate: '2024-01-01' },
    );
    expect(compareWithIndex([], 0, history, '2025-06-05')).toEqual({ status: 'empty' });
  });

  it('shows no yearly return before a year has passed', () => {
    const result = compareWithIndex(
      [{ date: '2025-01-01', amount: -1_200_000 }],
      1_400_000,
      history,
      '2025-06-05',
    );
    expect(result).toMatchObject({ status: 'ok', yourXirr: null, indexXirr: null });
  });
});
