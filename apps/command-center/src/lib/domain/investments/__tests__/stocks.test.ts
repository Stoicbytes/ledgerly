import { stock, trade } from '../__fixtures__';
import { sharesHeldOn, stockPosition, stockQuote } from '../stocks';
import { EMPTY_MARKET, type MarketData } from '../types';

describe('stockPosition', () => {
  it('gives bonus shares at zero cost and sells the oldest shares first', () => {
    const trades = [
      trade('buy', '2025-01-10', { quantity: 10, price: 250000, charges: 2000 }),
      trade('bonus', '2025-06-01', { ratioFrom: 1, ratioTo: 1 }),
      trade('sell', '2026-02-01', { quantity: 15, price: 280000, charges: 2500 }),
    ];
    const position = stockPosition(trades, {
      price: 300000,
      date: '2026-10-07',
      source: 'exchange',
      previous: 290000,
    });
    expect(position.quantity).toBe(5);
    expect(position.invested).toBe(0);
    expect(position.realised).toBe(4197500 - 2502000);
    expect(position.realisedLots.map((lot) => [lot.buyDate, lot.quantity, lot.cost])).toEqual([
      ['2025-01-10', 10, 2502000],
      ['2025-06-01', 5, 0],
    ]);
    expect(position.value).toBe(1500000);
    expect(position.dayChange).toBe(50000);
  });

  it('applies splits to shares held before that day', () => {
    const trades = [
      trade('buy', '2025-01-10', { quantity: 10, price: 100000 }),
      trade('split', '2025-03-01', { ratioFrom: 1, ratioTo: 5 }),
      trade('buy', '2025-03-01', { quantity: 3, price: 20000 }),
    ];
    const position = stockPosition(trades, null);
    expect(position.quantity).toBe(53);
    expect(position.invested).toBe(1060000);
    expect(position.avgCost).toBeCloseTo(20000, 6);
    expect(sharesHeldOn(trades, '2025-02-28')).toBe(10);
  });

  it('rounds reverse splits down to whole shares', () => {
    const trades = [
      trade('buy', '2025-01-10', { quantity: 25, price: 1000 }),
      trade('split', '2025-03-01', { ratioFrom: 10, ratioTo: 1 }),
    ];
    expect(stockPosition(trades, null).quantity).toBe(2);
  });

  it('counts dividends', () => {
    const trades = [
      trade('buy', '2025-01-10', { quantity: 1, price: 1000 }),
      trade('dividend', '2025-05-10', { amount: 500 }),
    ];
    expect(stockPosition(trades, null).dividends).toBe(500);
  });
});

describe('stockQuote', () => {
  const market: MarketData = {
    ...EMPTY_MARKET,
    securities: {
      INE002A01018: {
        symbol: 'RELIANCE',
        name: '',
        exchange: 'NSE',
        close: 300000,
        prevClose: 295000,
        priceDate: '2026-10-07',
      },
    },
  };

  it('uses the exchange close, a newer manual price, or the latest trade', () => {
    expect(stockQuote(stock(), [], market)).toEqual({
      price: 300000,
      date: '2026-10-07',
      source: 'exchange',
      previous: 295000,
    });
    expect(
      stockQuote(stock({ manualPrice: 1, manualPriceDate: '2026-10-08' }), [], market)?.source,
    ).toBe('manual');
    const unlisted = stock({ isin: null });
    expect(
      stockQuote(unlisted, [trade('buy', '2026-01-01', { quantity: 1, price: 777 })], market)
        ?.price,
    ).toBe(777);
    expect(stockQuote(unlisted, [], market)).toBeNull();
  });
});
