import { savingsRates, spendingPace } from '@/lib/domain/insights';
import type { Transaction } from '@/lib/domain/expenses';

let n = 0;
const tx = (date: string, over: Partial<Transaction> = {}): Transaction => ({
  id: `t${(n += 1)}`,
  kind: 'expense',
  date,
  amount: 1_000_00,
  accountId: 'bank',
  toAccountId: null,
  fee: 0,
  categoryId: 'food',
  note: '',
  createdAt: n,
  ...over,
});

describe('spending pace', () => {
  it('adds up spending day by day, next to last month at the same day', () => {
    const days = spendingPace(
      [
        tx('2026-10-01', { amount: 5_000_00 }),
        tx('2026-10-03'),
        tx('2026-10-04'), // after today: left out
        tx('2026-10-02', { kind: 'income', amount: 50_000_00 }),
        tx('2026-10-02', { kind: 'transfer', toAccountId: 'wallet', fee: 10_00 }),
        tx('2026-09-02', { amount: 2_000_00 }),
        tx('2026-09-20'),
      ],
      '2026-10-03',
    );
    expect(days).toEqual([
      { day: 1, spent: 5_000_00, last: 0 },
      { day: 2, spent: 5_010_00, last: 2_000_00 },
      { day: 3, spent: 6_010_00, last: 2_000_00 },
    ]);
  });

  it('holds a shorter last month at its final day', () => {
    // February 2027 has 28 days; on 31 March it still counts all of February
    const days = spendingPace([tx('2027-02-28'), tx('2027-03-31')], '2027-03-31');
    expect(days).toHaveLength(31);
    expect(days[27].last).toBe(1_000_00);
    expect(days[30]).toEqual({ day: 31, spent: 1_000_00, last: 1_000_00 });
  });

  it('counts only your share of a split expense', () => {
    const shared = tx('2026-10-01', {
      amount: 3_000_00,
      splits: [{ personId: 'p1', amount: 2_000_00 }],
    });
    expect(spendingPace([shared], '2026-10-01')[0].spent).toBe(1_000_00);
  });
});

describe('savings rates', () => {
  it('gives each month its share of income kept, and null without income', () => {
    const rates = savingsRates(
      [
        tx('2026-09-01', { kind: 'income', amount: 10_000_00 }),
        tx('2026-09-05', { amount: 2_500_00 }),
        tx('2026-10-05'),
      ],
      '2026-10',
      3,
    );
    expect(rates.map((item) => item.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(rates[0].rate).toBeNull();
    expect(rates[1]).toEqual({ month: '2026-09', income: 10_000_00, net: 7_500_00, rate: 75 });
    expect(rates[2]).toMatchObject({ income: 0, net: -1_000_00, rate: null });
  });
});
