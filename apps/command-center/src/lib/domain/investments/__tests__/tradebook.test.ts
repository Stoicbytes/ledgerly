import {
  buildAdditions,
  fundNameKey,
  mergeTradebooks,
  planImport,
  readTradebook,
  tradeDate,
} from '..';
import { EMPTY_PORTFOLIO, type Portfolio } from '../types';
import { buy, fund, stock, trade } from '../__fixtures__';

const HEADER = [
  '',
  'Symbol',
  'ISIN',
  'Trade Date',
  'Exchange',
  'Segment',
  'Series',
  'Trade Type',
  'Auction',
  'Quantity',
  'Price',
  'Trade ID',
];
const row = (
  symbol: string,
  isin: string,
  date: string,
  segment: string,
  kind: string,
  qty: number,
  price: number,
  id: string,
) => ['', symbol, isin, date, 'NSE', segment, '', kind, false, qty, price, id];

const FUND_ISIN = 'INF000S01011';
const ETF_ISIN = 'INF000S01029';
const funds = readTradebook(
  [
    ['', 'Client ID', 'AB1234'],
    ['', 'Tradebook for Mutual Funds from 2026-01-01 to 2026-03-31'],
    HEADER,
    row(
      'SAMPLE FLEXI CAP FUND - DIRECT PLAN',
      FUND_ISIN,
      '2026-01-01',
      'MF',
      'buy',
      10.5,
      95.2381,
      'm1',
    ),
    row(
      'SAMPLE FLEXI CAP FUND - DIRECT PLAN',
      FUND_ISIN,
      '2026-02-02',
      'MF',
      'buy',
      11.111,
      90,
      'm2',
    ),
    row('OLD SAMPLE FUND - DIRECT PLAN', 'INF000S01037', '2026-01-10', 'MF', 'sell', 3, 20, 'm3'),
  ],
  'funds.xlsx',
);
const equity = readTradebook(
  [
    HEADER,
    row('SAMPLEBEES', ETF_ISIN, '2026-01-05', 'EQ', 'buy', 10, 50.25, 'e1'),
    row('SAMPLEBEES', ETF_ISIN, '2026-03-01', 'EQ', 'sell', 4, 60, 'e2'),
    row('SAMPLEBEES', ETF_ISIN, '2026-01-05', 'EQ', 'buy', 10, 50.25, 'e1'),
    row('BAD', 'XX', '2026-01-05', 'EQ', 'buy', 1, 1, 'e3'),
    row('HALF', ETF_ISIN, '2026-01-05', 'EQ', 'buy', 1.5, 1, 'e4'),
  ],
  'equity.csv',
);

describe('readTradebook', () => {
  it('finds the header, reads each trade and names bad rows', () => {
    expect(funds.trades).toHaveLength(3);
    expect(funds.trades[0]).toMatchObject({
      segment: 'funds',
      isin: FUND_ISIN,
      kind: 'buy',
      quantity: 10.5,
      price: 95.2381,
      tradeId: 'm1',
    });
    expect(equity.problems).toEqual([
      'equity.csv, row 5: no valid ISIN.',
      'equity.csv, row 6: the quantity is not valid.',
    ]);
    expect(readTradebook([['a', 'b']], 'x.xlsx').problems[0]).toMatch(/not a broker tradebook/);
  });

  it('reads dates as text or spreadsheet serials, and refuses impossible ones', () => {
    expect(tradeDate('2026-02-28')).toBe('2026-02-28');
    expect(tradeDate('05-03-2026')).toBe('2026-03-05');
    expect(tradeDate(46023)).toBe('2026-01-01');
    expect(tradeDate('2026-02-30')).toBeNull();
  });

  it('counts a trade once when files overlap', () => {
    const merged = mergeTradebooks([funds, equity]);
    expect(merged.trades.filter((t) => t.tradeId === 'e1')).toHaveLength(1);
    expect(merged.trades.map((t) => t.date)).toEqual([...merged.trades.map((t) => t.date)].sort());
  });

  it('matches fund names across share classes and punctuation', () => {
    expect(fundNameKey('SAMPLE FLEXI CAP FUND - DIRECT PLAN')).toBe(
      fundNameKey('Sample Flexi Cap Fund - Direct Growth'),
    );
    expect(fundNameKey('NAVI NIFTY 50 INDEX FUND-DIRECT PLAN-GROWT')).toBe('navinifty50indexfund');
  });
});

describe('planImport', () => {
  const trades = mergeTradebooks([funds, equity]).trades;

  it('plans new holdings, and leaves out sales of units bought before the file', () => {
    const plans = planImport(trades, EMPTY_PORTFOLIO);
    const flexi = plans.find((p) => p.isin === FUND_ISIN)!;
    expect(flexi).toMatchObject({
      existingId: null,
      name: 'Sample Flexi Cap Fund - Direct Plan',
      already: 0,
    });
    expect(flexi.add.map((t) => t.amount)).toEqual([100000, 99999]);
    expect(flexi.after).toMatchObject({ held: 21.611, invested: 199999 });
    const old = plans.find((p) => p.isin === 'INF000S01037')!;
    expect(old.add).toHaveLength(0);
    expect(old.leftOut).toHaveLength(1);
    const etf = plans.find((p) => p.isin === ETF_ISIN)!;
    expect(etf.after).toMatchObject({ held: 6, invested: 30150, realised: 3900 });
    expect(plans[0].segment).toBe('funds');
  });

  it('skips trades already in the app and matches a fund without ISIN by name', () => {
    const portfolio: Portfolio = {
      ...EMPTY_PORTFOLIO,
      funds: [fund({ id: 'f1', isin: null, name: 'Sample Flexi Cap Fund - Direct Growth' })],
      fundTxns: [buy('2026-01-01', 100000, 10.5, 95.2381, { fundId: 'f1' })],
      stocks: [stock({ id: 's1', isin: ETF_ISIN, symbol: 'SAMPLEBEES' })],
      trades: [trade('buy', '2026-01-05', { stockId: 's1', quantity: 10, price: 5025 })],
    };
    const plans = planImport(trades, portfolio);
    const flexi = plans.find((p) => p.isin === FUND_ISIN)!;
    expect(flexi).toMatchObject({ existingId: 'f1', already: 1 });
    expect(flexi.add.map((t) => t.date)).toEqual(['2026-02-02']);
    expect(flexi.before.held).toBe(10.5);
    const etf = plans.find((p) => p.isin === ETF_ISIN)!;
    expect(etf).toMatchObject({ existingId: 's1', already: 1 });
    expect(etf.add.map((t) => t.kind)).toEqual(['sell']);

    let next = 0;
    const additions = buildAdditions(
      plans,
      new Set([flexi.key, etf.key]),
      portfolio,
      () => `id${++next}`,
      5,
    );
    expect(additions.funds).toEqual([expect.objectContaining({ id: 'f1', isin: FUND_ISIN })]);
    expect(additions.fundTxns).toEqual([
      expect.objectContaining({
        fundId: 'f1',
        date: '2026-02-02',
        amount: 99999,
        units: 11.111,
        nav: 90,
        stampDuty: 0,
        createdAt: 5,
      }),
    ]);
    expect(additions.stocks).toEqual([]);
    expect(additions.trades).toEqual([
      expect.objectContaining({ stockId: 's1', kind: 'sell', quantity: 4, price: 6000 }),
    ]);
  });

  it('adds only what was approved, creating new funds and stocks', () => {
    const plans = planImport(trades, EMPTY_PORTFOLIO);
    const etf = plans.find((p) => p.isin === ETF_ISIN)!;
    const additions = buildAdditions(plans, new Set([etf.key]), EMPTY_PORTFOLIO, () => 'new');
    expect(additions.funds).toEqual([]);
    expect(additions.stocks).toEqual([
      expect.objectContaining({ isin: ETF_ISIN, symbol: 'SAMPLEBEES', exchange: 'NSE' }),
    ]);
    expect(additions.trades).toHaveLength(2);
  });
});
