import { marketFromRemote } from '../marketRepository';

describe('marketFromRemote', () => {
  it('maps load_market output', () => {
    const market = marketFromRemote({
      schemes: [
        {
          scheme_code: 120465,
          name: 'Fund',
          fund_house: 'H',
          category: 'C',
          nav: 58.12,
          nav_date: '2026-10-07',
        },
      ],
      nav_history: { '120465': [['2026-10-06', 57.9], ['2026-10-07', 58.12], ['bad']] },
      securities: [
        {
          isin: 'INE002A01018',
          symbol: 'RELIANCE',
          name: 'R',
          exchange: 'NSE',
          close: 295050,
          prev_close: 290000,
          price_date: '2026-10-07',
        },
      ],
      price_history: { INE002A01018: [['2026-10-07', 295050]] },
      runs: [
        {
          source: 'amfi',
          status: 'ok',
          finished_at: '2026-10-07T18:00:00Z',
          data_date: '2026-10-07',
          message: 'NAVs updated',
        },
      ],
    });
    expect(market.schemes['120465']).toEqual({
      name: 'Fund',
      fundHouse: 'H',
      category: 'C',
      nav: 58.12,
      navDate: '2026-10-07',
    });
    expect(market.navHistory['120465']).toEqual([
      ['2026-10-06', 57.9],
      ['2026-10-07', 58.12],
    ]);
    expect(market.securities.INE002A01018).toMatchObject({ close: 295050, prevClose: 290000 });
    expect(market.runs[0]).toMatchObject({ source: 'amfi', status: 'ok' });
  });

  it('copes with an empty response', () => {
    expect(marketFromRemote(null)).toEqual({
      schemes: {},
      navHistory: {},
      securities: {},
      priceHistory: {},
      runs: [],
    });
  });
});
