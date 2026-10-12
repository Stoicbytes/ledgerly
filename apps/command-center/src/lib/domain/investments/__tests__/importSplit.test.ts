import { buildAdditions, planImport } from '..';
import type { TradebookTrade } from '../tradebook';
import { EMPTY_PORTFOLIO, type Portfolio } from '../types';
import { stock, trade } from '../__fixtures__';

const OLD = 'INE000A01018';
const NEW = 'INE000A01026';
const t = (isin: string, date: string, kind: 'buy' | 'sell', quantity: number, price: number) =>
  ({
    segment: 'equity',
    isin,
    symbol: 'SAMPLECO',
    exchange: 'NSE',
    date,
    kind,
    quantity,
    price,
    tradeId: `${isin}${date}${kind}`,
  }) satisfies TradebookTrade;

describe('a share that changed ISIN (after a split)', () => {
  const file = [t(NEW, '2026-06-02', 'buy', 10, 100), t(OLD, '2026-01-05', 'buy', 5, 1000)];

  it('is one holding, under the newest ISIN', () => {
    const plans = planImport(file, EMPTY_PORTFOLIO);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ isin: NEW, isins: [OLD, NEW], symbol: 'SAMPLECO' });
    expect(plans[0].add.map((item) => item.date)).toEqual(['2026-01-05', '2026-06-02']);
    const additions = buildAdditions(plans, new Set([plans[0].key]), EMPTY_PORTFOLIO, () => 'n', 1);
    expect(additions.stocks).toHaveLength(1);
  });

  it('joins the stock already in the app and moves it to the new ISIN for prices', () => {
    const portfolio: Portfolio = {
      ...EMPTY_PORTFOLIO,
      stocks: [stock({ id: 's1', isin: OLD, symbol: 'SAMPLECO', exchange: 'NSE' })],
      trades: [trade('buy', '2026-01-05', { stockId: 's1', quantity: 5, price: 100_000 })],
    };
    const plans = planImport(file, portfolio);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ existingId: 's1', already: 1 });
    let id = 0;
    const additions = buildAdditions(
      plans,
      new Set([plans[0].key]),
      portfolio,
      () => `x${++id}`,
      1,
    );
    expect(additions.stocks).toEqual([expect.objectContaining({ id: 's1', isin: NEW })]);
    expect(additions.trades).toHaveLength(1);
  });

  it('keeps the ISIN of a stock the file does not mention', () => {
    const portfolio: Portfolio = {
      ...EMPTY_PORTFOLIO,
      stocks: [stock({ id: 's1', isin: 'INE999Z01011', symbol: 'SAMPLECO', exchange: 'NSE' })],
    };
    const plans = planImport(file, portfolio);
    const additions = buildAdditions(plans, new Set([plans[0].key]), portfolio, () => 'y', 1);
    expect(plans[0].existingId).toBe('s1');
    expect(additions.stocks).toEqual([]);
  });
});
