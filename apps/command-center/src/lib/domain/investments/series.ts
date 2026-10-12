import { addMonths, monthBounds, monthOf } from '../expenses/dates';
import { navOn, replayFund, sortFundTxns } from './funds';
import { unitsValue } from './math';
import { fundRows, stockRows, type StockRow } from './portfolio';
import { replayStock, sortTrades } from './stocks';
import type { MarketData, Portfolio, Series } from './types';

const lastOnOrBefore = (points: Series | undefined, date: string) => {
  if (!points) return null;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index][0] <= date) return points[index][1];
  }
  return null;
};

export type ValueSeries = { months: string[]; invested: number[]; value: number[] };

/** Month-end points from `months` months ago to today: cost of what was held and its value. */
function monthEnds(first: string | null, today: string, months: number | 'all'): string[] {
  const current = monthOf(today);
  const start =
    months === 'all' ? (first ? monthOf(first) : current) : addMonths(current, -(months - 1));
  const list: string[] = [];
  for (let month = start; month <= current; month = addMonths(month, 1)) list.push(month);
  return list;
}

export function fundValueSeries(
  portfolio: Portfolio,
  market: MarketData,
  today: string,
  months: number | 'all' = 12,
): ValueSeries {
  const rows = fundRows(portfolio, market, today);
  const first = sortFundTxns(portfolio.fundTxns)[0]?.date ?? null;
  const list = monthEnds(first, today, months);
  const invested: number[] = [];
  const value: number[] = [];
  for (const month of list) {
    const end = month === monthOf(today) ? today : monthBounds(month).end;
    let cost = 0;
    let worth = 0;
    for (const row of rows) {
      if (end === today) {
        cost += row.position.invested;
        worth += row.position.value;
        continue;
      }
      const held = replayFund(row.txns, end);
      if (!held.units4) continue;
      const lastNav = sortFundTxns(row.txns.filter((txn) => txn.nav && txn.date <= end)).pop()?.nav;
      const manual =
        row.fund.manualNav && row.fund.manualNavDate && row.fund.manualNavDate <= end
          ? row.fund.manualNav
          : null;
      const nav = navOn(market, row.fund.schemeCode, end) ?? manual ?? lastNav ?? null;
      cost += held.invested;
      worth += nav ? unitsValue(held.units4, nav) : held.invested;
    }
    invested.push(cost);
    value.push(worth);
  }
  return { months: list, invested, value };
}

export function stockValueSeries(
  portfolio: Portfolio,
  market: MarketData,
  today: string,
  months: number | 'all' = 12,
): ValueSeries {
  const rows = stockRows(portfolio, market, today);
  const first = sortTrades(portfolio.trades)[0]?.date ?? null;
  const list = monthEnds(first, today, months);
  const invested: number[] = [];
  const value: number[] = [];
  for (const month of list) {
    const end = month === monthOf(today) ? today : monthBounds(month).end;
    let cost = 0;
    let worth = 0;
    for (const row of rows) {
      if (end === today) {
        cost += row.position.invested;
        worth += row.position.value;
        continue;
      }
      const held = replayStock(row.trades, end);
      if (!held.quantity) continue;
      const lastPrice = sortTrades(
        row.trades.filter((trade) => trade.price && trade.date <= end),
      ).pop()?.price;
      const price =
        lastOnOrBefore(row.stock.isin ? market.priceHistory[row.stock.isin] : undefined, end) ??
        lastPrice ??
        null;
      cost += held.invested;
      worth += price ? held.quantity * price : held.invested;
    }
    invested.push(cost);
    value.push(worth);
  }
  return { months: list, invested, value };
}

/** Price history for one stock's chart: stored closes, else its own trade prices. */
export function stockPriceSeries(row: StockRow, market: MarketData): Series {
  const stored = row.stock.isin ? (market.priceHistory[row.stock.isin] ?? []) : [];
  if (stored.length >= 2) return stored;
  const points = new Map<string, number>(stored);
  for (const trade of sortTrades(row.trades)) {
    if (trade.price && (trade.kind === 'buy' || trade.kind === 'sell'))
      points.set(trade.date, trade.price);
  }
  if (row.quote) points.set(row.quote.date, row.quote.price);
  return [...points.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
