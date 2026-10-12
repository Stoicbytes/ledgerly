import { EMPTY_PORTFOLIO, type Portfolio } from '@/lib/domain/investments';
import { portfolioChanges, portfolioFromRemote } from '../portfolioRows';

const remote = {
  mf_funds: [
    {
      id: 'f1',
      scheme_code: 120465,
      isin: 'INF000S01011',
      name: 'Horizon Bluechip',
      category: 'Equity Scheme - Large Cap Fund',
      fund_house: 'Horizon',
      folio: '1/2',
      manual_nav: null,
      manual_nav_date: null,
      note: '',
      archived: false,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  mf_sips: [
    {
      id: 's1',
      fund_id: 'f1',
      amount: 500000,
      day_of_month: 5,
      start_date: '2026-01-05',
      end_date: null,
      active: true,
      note: '',
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  mf_transactions: [
    {
      id: 't1',
      fund_id: 'f1',
      kind: 'buy',
      trade_date: '2026-01-05',
      amount: 500000,
      stamp_duty: 25,
      units: 62.1234,
      nav: 80.4567,
      sip_id: 's1',
      note: '',
      created_at: '2026-01-05T10:00:00Z',
    },
  ],
  stocks: [
    {
      id: 'k1',
      isin: 'INE002A01018',
      symbol: 'RELIANCE',
      exchange: 'NSE',
      name: 'Reliance',
      sector: 'Energy',
      manual_price: null,
      manual_price_date: null,
      note: '',
      archived: false,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  stock_trades: [
    {
      id: 'r1',
      stock_id: 'k1',
      kind: 'split',
      trade_date: '2026-02-01',
      quantity: null,
      price: null,
      charges: 0,
      amount: null,
      ratio_from: 1,
      ratio_to: 5,
      note: '',
      created_at: '2026-02-01T00:00:00Z',
    },
  ],
};

describe('portfolio rows', () => {
  it('maps database rows to the app and back without changes', () => {
    const portfolio = portfolioFromRemote(remote);
    expect(portfolio.funds[0].isin).toBe('INF000S01011');
    expect(portfolio.fundTxns[0]).toMatchObject({
      units: 62.1234,
      nav: 80.4567,
      sipId: 's1',
      stampDuty: 25,
    });
    expect(portfolio.trades[0]).toMatchObject({
      kind: 'split',
      ratioFrom: 1,
      ratioTo: 5,
      quantity: null,
    });
    expect(portfolio.sips[0]).toMatchObject({ day: 5, active: true });
    const changes = portfolioChanges(portfolio, portfolio);
    expect(changes.diffs.every((diff) => !diff.upserts.length && !diff.deletes.length)).toBe(true);
  });

  it('sends new and changed rows in database names and deleted ids', () => {
    const before = portfolioFromRemote(remote);
    const after: Portfolio = {
      ...before,
      funds: [{ ...before.funds[0], folio: '9/9' }],
      trades: [],
    };
    const changes = portfolioChanges(before, after);
    expect(changes.upserts.mf_funds).toEqual([
      expect.objectContaining({
        id: 'f1',
        folio: '9/9',
        scheme_code: 120465,
        isin: 'INF000S01011',
      }),
    ]);
    expect(changes.deletes.stock_trades).toEqual(['r1']);
    expect(portfolioChanges(EMPTY_PORTFOLIO, before).upserts.mf_transactions).toEqual([
      expect.objectContaining({ trade_date: '2026-01-05', units: 62.1234, sip_id: 's1' }),
    ]);
  });
});
