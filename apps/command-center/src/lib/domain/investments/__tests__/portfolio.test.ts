import { buy, fund, stock, trade } from '../__fixtures__';
import { allocation, fundRows, fundTotals, stockRows, stockTotals } from '../portfolio';
import { fundValueSeries, stockPriceSeries } from '../series';
import { EMPTY_MARKET, EMPTY_PORTFOLIO, type MarketData, type Portfolio } from '../types';

const market: MarketData = {
  ...EMPTY_MARKET,
  schemes: { '120465': { name: '', fundHouse: '', category: '', nav: 12, navDate: '2026-10-07' } },
  navHistory: {
    '120465': [
      ['2026-08-31', 10.5],
      ['2026-09-30', 11],
      ['2026-10-06', 11.5],
      ['2026-10-07', 12],
    ],
  },
};

const portfolio: Portfolio = {
  ...EMPTY_PORTFOLIO,
  funds: [
    fund(),
    fund({ id: 'f2', schemeCode: null, category: 'Debt Scheme - Liquid Fund', archived: true }),
  ],
  fundTxns: [buy('2026-08-05', 100000, 100, 10), buy('2026-09-05', 100000, 100, 10)],
};

describe('fund portfolio', () => {
  it('values every fund and totals them', () => {
    const rows = fundRows(portfolio, market, '2026-10-08');
    // The archived fund without units is hidden.
    expect(rows.map((row) => row.fund.id)).toEqual(['f1']);
    expect(rows[0]).toMatchObject({
      dayChange: 10000,
      assetClass: 'Equity',
      categoryLabel: 'Large Cap Fund',
    });
    const totals = fundTotals(rows, '2026-10-08');
    expect(totals).toMatchObject({
      value: 240000,
      invested: 200000,
      unrealised: 40000,
      dayChange: 10000,
      count: 1,
    });
    // Two months of history: a 20 % gain would read as over 100 % a year, so no XIRR yet.
    expect(totals.xirr).toBeNull();
    expect(rows[0].xirr).toBeNull();
    // A year after the first purchase it is annualised.
    const later = fundTotals(fundRows(portfolio, market, '2027-08-05'), '2027-08-05');
    expect(later.xirr).toBeGreaterThan(0.2);
    expect(later.xirr).toBeLessThan(0.3);
  });

  it('builds month-end values from NAV history', () => {
    const series = fundValueSeries(portfolio, market, '2026-10-08', 3);
    expect(series.months).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(series.invested).toEqual([100000, 200000, 200000]);
    expect(series.value).toEqual([105000, 220000, 240000]);
  });

  it('works out allocation shares', () => {
    expect(
      allocation([
        { label: 'A', value: 300 },
        { label: 'B', value: 100 },
        { label: 'A', value: 0 },
      ]),
    ).toEqual([
      { label: 'A', value: 300, share: 75 },
      { label: 'B', value: 100, share: 25 },
    ]);
  });
});

describe('stock portfolio', () => {
  const holdings: Portfolio = {
    ...EMPTY_PORTFOLIO,
    stocks: [stock()],
    trades: [trade('buy', '2026-09-01', { quantity: 10, price: 280000 })],
  };
  const prices: MarketData = {
    ...EMPTY_MARKET,
    securities: {
      INE002A01018: {
        symbol: 'RELIANCE',
        name: '',
        exchange: 'NSE',
        close: 300000,
        prevClose: 290000,
        priceDate: '2026-10-07',
      },
    },
  };

  it('totals holdings with the day change', () => {
    const rows = stockRows(holdings, prices, '2026-10-08');
    expect(rows[0].dayChangePct).toBeCloseTo(3.448, 2);
    expect(stockTotals(rows, '2026-10-08')).toMatchObject({
      value: 3000000,
      invested: 2800000,
      dayChange: 100000,
    });
  });

  it('charts trade prices until closes are stored', () => {
    const [row] = stockRows(holdings, prices, '2026-10-08');
    expect(stockPriceSeries(row, prices)).toEqual([
      ['2026-09-01', 280000],
      ['2026-10-07', 300000],
    ]);
  });
});
