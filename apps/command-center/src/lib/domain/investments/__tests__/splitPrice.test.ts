import { stock, trade } from '../__fixtures__';
import { stockValueSeries } from '../series';
import { stockQuote } from '../stocks';
import { EMPTY_MARKET, EMPTY_PORTFOLIO } from '../types';

describe('unpriced stocks after a split or bonus', () => {
  const trades = [
    trade('buy', '2025-01-10', { quantity: 10, price: 1000_00 }),
    trade('split', '2025-06-01', { ratioFrom: 1, ratioTo: 5 }),
    trade('bonus', '2025-09-01', { ratioFrom: 1, ratioTo: 1 }),
  ];

  it('adjusts the last trade price by later splits and bonuses, marked as an estimate', () => {
    const quote = stockQuote(stock({ isin: null }), trades, EMPTY_MARKET);
    // 1,000 ÷ 5 (split) ÷ 2 (1:1 bonus) = 100 a share; 100 shares, so the value stays 10,000
    expect(quote).toMatchObject({ price: 100_00, date: '2025-01-10', source: 'last entry' });
  });

  it('values past months the same way', () => {
    const series = stockValueSeries(
      { ...EMPTY_PORTFOLIO, stocks: [stock({ isin: null })], trades },
      EMPTY_MARKET,
      '2025-10-15',
      6,
    );
    // May: 10 × 1,000; July: 50 × 200; September: 100 × 100
    expect(series.value).toEqual([
      10_000_00, 10_000_00, 10_000_00, 10_000_00, 10_000_00, 10_000_00,
    ]);
  });
});
