import { buy, fund, sell, stock, trade } from '../__fixtures__';
import {
  allFundRows,
  allStockRows,
  fundRows,
  fundTotals,
  stockRows,
  stockTotals,
} from '../portfolio';
import { EMPTY_MARKET, EMPTY_PORTFOLIO, type Portfolio } from '../types';

describe('archived holdings', () => {
  it('keep a sold, archived fund in the totals but out of the list', () => {
    const portfolio: Portfolio = {
      ...EMPTY_PORTFOLIO,
      funds: [
        fund({ manualNav: 12, manualNavDate: '2026-10-01' }),
        fund({ id: 'f2', schemeCode: null, archived: true }),
      ],
      fundTxns: [
        buy('2024-01-05', 100_000_00, 1000, 100),
        buy('2024-01-05', 50_000_00, 500, 100, { fundId: 'f2' }),
        sell('2025-01-05', 60_000_00, 500, 120, { fundId: 'f2' }),
      ],
    };
    const rows = fundRows(portfolio, EMPTY_MARKET, '2026-10-08');
    expect(rows.map((row) => row.fund.id)).toEqual(['f1']);
    const totals = fundTotals(allFundRows(portfolio, EMPTY_MARKET, '2026-10-08'), '2026-10-08');
    // ₹10,000 gain on the sold fund stays in the realised total
    expect(totals.realised).toBe(10_000_00);
    expect(totals.count).toBe(1);
  });

  it('keep a sold, archived stock in the totals', () => {
    const portfolio: Portfolio = {
      ...EMPTY_PORTFOLIO,
      stocks: [stock({ archived: true })],
      trades: [
        trade('buy', '2024-01-05', { quantity: 10, price: 1000_00 }),
        trade('sell', '2025-01-05', { quantity: 10, price: 1500_00 }),
      ],
    };
    expect(stockRows(portfolio, EMPTY_MARKET, '2026-10-08')).toEqual([]);
    const totals = stockTotals(allStockRows(portfolio, EMPTY_MARKET, '2026-10-08'), '2026-10-08');
    expect(totals.realised).toBe(5_000_00);
    // ₹10,000 in, ₹15,000 out a year later: 50 % a year
    expect(totals.xirr).toBeCloseTo(0.5, 2);
  });
});
