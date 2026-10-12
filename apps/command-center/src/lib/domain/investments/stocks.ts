import { annualisedReturn, daysBetween, type CashFlow } from './math';
import type { MarketData, Quote, Stock, Trade } from './types';

/**
 * Same order as the database check: by date; bonus and split first (they apply to the
 * shares held before that day), then purchases, dividends, sales.
 */
const RANK: Record<Trade['kind'], number> = { bonus: 0, split: 0, buy: 1, dividend: 2, sell: 3 };

export function sortTrades(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      RANK[a.kind] - RANK[b.kind] ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  );
}

/** Shares still held from one purchase or bonus (bonus shares cost nothing). */
export type StockLot = { date: string; quantity: number; cost: number };

export type RealisedStockLot = {
  buyDate: string;
  sellDate: string;
  quantity: number;
  cost: number;
  proceeds: number;
  days: number;
};

export type StockPosition = {
  quantity: number;
  /** Cost of shares held incl. buy charges, paise. */
  invested: number;
  /** Average cost per share, paise. */
  avgCost: number;
  value: number;
  unrealised: number;
  /** Gains on shares sold (proceeds after charges − FIFO cost). */
  realised: number;
  dividends: number;
  /** Change since the previous close, paise (0 without a previous close). */
  dayChange: number;
  lots: StockLot[];
  realisedLots: RealisedStockLot[];
  flows: CashFlow[];
};

const total = (lots: StockLot[]) => lots.reduce((sum, lot) => sum + lot.quantity, 0);

/** Multiplies every lot by to/from, keeping whole shares and the holding-level total. */
function applySplit(lots: StockLot[], from: number, to: number) {
  const target = Math.floor((total(lots) * to) / from);
  for (const lot of lots) lot.quantity = Math.floor((lot.quantity * to) / from);
  let missing = target - total(lots);
  for (const lot of lots) {
    if (missing <= 0) break;
    lot.quantity += 1;
    missing -= 1;
  }
  for (let index = lots.length - 1; index >= 0; index -= 1) {
    if (lots[index].quantity === 0) lots.splice(index, 1);
  }
}

/** Replays a stock's trades up to `asOf` (inclusive). Sales use the oldest shares first. */
export function replayStock(
  trades: Trade[],
  asOf?: string,
): Omit<StockPosition, 'value' | 'unrealised' | 'dayChange'> {
  const lots: StockLot[] = [];
  const realisedLots: RealisedStockLot[] = [];
  const flows: CashFlow[] = [];
  let realised = 0;
  let dividends = 0;
  for (const trade of sortTrades(trades)) {
    if (asOf && trade.date > asOf) break;
    if (trade.kind === 'buy') {
      const cost = (trade.quantity ?? 0) * (trade.price ?? 0) + trade.charges;
      lots.push({ date: trade.date, quantity: trade.quantity ?? 0, cost });
      flows.push({ date: trade.date, amount: -cost });
    } else if (trade.kind === 'bonus') {
      const extra = Math.floor((total(lots) * (trade.ratioTo ?? 0)) / (trade.ratioFrom || 1));
      if (extra > 0) lots.push({ date: trade.date, quantity: extra, cost: 0 });
    } else if (trade.kind === 'split') {
      applySplit(lots, trade.ratioFrom || 1, trade.ratioTo ?? 1);
    } else if (trade.kind === 'dividend') {
      dividends += trade.amount ?? 0;
      flows.push({ date: trade.date, amount: trade.amount ?? 0 });
    } else {
      const quantity = trade.quantity ?? 0;
      const net = quantity * (trade.price ?? 0) - trade.charges;
      flows.push({ date: trade.date, amount: net });
      let remaining = quantity;
      let netLeft = net;
      while (remaining > 0 && lots.length) {
        const lot = lots[0];
        const take = Math.min(lot.quantity, remaining);
        const cost =
          take === lot.quantity ? lot.cost : Math.round((lot.cost * take) / lot.quantity);
        const proceeds = take === remaining ? netLeft : Math.round((net * take) / quantity);
        realisedLots.push({
          buyDate: lot.date,
          sellDate: trade.date,
          quantity: take,
          cost,
          proceeds,
          days: daysBetween(lot.date, trade.date),
        });
        realised += proceeds - cost;
        netLeft -= proceeds;
        lot.quantity -= take;
        lot.cost -= cost;
        remaining -= take;
        if (lot.quantity === 0) lots.shift();
      }
    }
  }
  const quantity = total(lots);
  const invested = lots.reduce((sum, lot) => sum + lot.cost, 0);
  return {
    quantity,
    invested,
    avgCost: quantity ? invested / quantity : 0,
    realised,
    dividends,
    lots,
    realisedLots,
    flows,
  };
}

export function stockPosition(trades: Trade[], quote: Quote | null, asOf?: string): StockPosition {
  const base = replayStock(trades, asOf);
  const value = quote ? base.quantity * quote.price : 0;
  return {
    ...base,
    value,
    unrealised: quote ? value - base.invested : 0,
    dayChange: quote?.previous ? base.quantity * (quote.price - quote.previous) : 0,
  };
}

export const sharesHeldOn = (trades: Trade[], date: string) => replayStock(trades, date).quantity;

/**
 * The price used to value a stock: the newest of the exchange close and a manual price,
 * else the price of the latest buy or sell.
 */
export function stockQuote(stock: Stock, trades: Trade[], market: MarketData): Quote | null {
  const security = stock.isin ? market.securities[stock.isin] : undefined;
  const exchange =
    security?.close && security.priceDate
      ? {
          price: security.close,
          date: security.priceDate,
          source: 'exchange' as const,
          previous: security.prevClose,
        }
      : null;
  const manual =
    stock.manualPrice && stock.manualPriceDate
      ? {
          price: stock.manualPrice,
          date: stock.manualPriceDate,
          source: 'manual' as const,
          previous: null,
        }
      : null;
  if (exchange && manual) return manual.date > exchange.date ? manual : exchange;
  if (exchange || manual) return exchange ?? manual;
  const last = sortTrades(trades.filter((trade) => trade.price)).pop();
  return last?.price
    ? { price: last.price, date: last.date, source: 'last entry', previous: null }
    : null;
}

export function stockXirr(position: StockPosition, asOf: string): number | null {
  const flows = [...position.flows];
  if (position.value) flows.push({ date: asOf, amount: position.value });
  return annualisedReturn(flows, asOf);
}
