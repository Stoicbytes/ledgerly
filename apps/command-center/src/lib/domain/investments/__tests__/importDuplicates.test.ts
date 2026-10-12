import { defaultSelection, planImport, selectionCheck, selectTrades } from '..';
import type { TradebookTrade } from '../tradebook';
import { EMPTY_PORTFOLIO, type Portfolio } from '../types';
import { stock, trade } from '../__fixtures__';

const ISIN = 'INE002A01018';
const t = (date: string, kind: 'buy' | 'sell', quantity: number, price: number, n = 0) =>
  ({
    segment: 'equity',
    isin: ISIN,
    symbol: 'RELIANCE',
    exchange: 'NSE',
    date,
    kind,
    quantity,
    price,
    tradeId: `${date}${kind}${n}`,
  }) satisfies TradebookTrade;

/** The app has one buy of 10 at ₹1,200.00 on 3 March. */
const portfolio: Portfolio = {
  ...EMPTY_PORTFOLIO,
  stocks: [stock()],
  trades: [trade('buy', '2026-03-03', { quantity: 10, price: 120000 })],
};

const plan = (file: TradebookTrade[]) => planImport(file, portfolio)[0];

describe('possible duplicates in an import', () => {
  it('skips the exact trade and adds a missing month as new', () => {
    const result = plan([t('2026-03-03', 'buy', 10, 1200), t('2026-04-03', 'buy', 5, 1300)]);
    expect(result.already).toBe(1);
    expect(result.add).toEqual([expect.objectContaining({ date: '2026-04-03', duplicate: null })]);
  });

  it('flags the same day and quantity at another price', () => {
    const result = plan([t('2026-03-03', 'buy', 10, 1199.5)]);
    expect(result.add[0].duplicate).toMatch(/has this buy on this day at ₹1,200\.00/);
    expect(defaultSelection([result]).size).toBe(0);
  });

  it('flags fills that add up to one trade in the app', () => {
    const result = plan([t('2026-03-03', 'buy', 4, 1200, 1), t('2026-03-03', 'buy', 6, 1200, 2)]);
    expect(result.add.map((item) => item.duplicate)).toEqual([
      expect.stringMatching(/adds up to one buy in the app/),
      expect.stringMatching(/adds up to one buy in the app/),
    ]);
  });

  it('flags another trade on a day the app already has one', () => {
    expect(plan([t('2026-03-03', 'buy', 3, 1210)]).add[0].duplicate).toMatch(
      /already has a buy on this day/,
    );
  });

  it('does not flag a sale on a day with only a buy', () => {
    expect(plan([t('2026-03-03', 'sell', 2, 1250)]).add[0].duplicate).toBeNull();
  });
});

describe('choosing trades', () => {
  const file = [t('2026-05-01', 'buy', 5, 1300), t('2026-06-01', 'sell', 12, 1400)];

  it('keeps every sale covered with what is ticked', () => {
    const result = plan(file);
    const all = defaultSelection([result]);
    expect(selectionCheck(selectTrades([result], all)[0], portfolio)).toEqual({
      held: 3,
      invested: expect.any(Number),
      covered: true,
    });
    const withoutBuy = new Set([...all].filter((id) => id !== result.add[0].id));
    expect(selectionCheck(selectTrades([result], withoutBuy)[0], portfolio).covered).toBe(false);
  });
});
