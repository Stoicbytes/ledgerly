import {
  fundAssetClass,
  fundCategoryLabel,
  fundPosition,
  fundQuote,
  fundXirr,
  type FundPosition,
} from './funds';
import { annualisedReturn, unitsValue, type CashFlow } from './math';
import { stockPosition, stockQuote, stockXirr, type StockPosition } from './stocks';
import type { Fund, FundTxn, MarketData, Portfolio, Quote, Stock, Trade } from './types';

export type FundRow = {
  fund: Fund;
  txns: FundTxn[];
  position: FundPosition;
  quote: Quote | null;
  xirr: number | null;
  dayChange: number;
  assetClass: string;
  categoryLabel: string;
};

export type StockRow = {
  stock: Stock;
  trades: Trade[];
  position: StockPosition;
  quote: Quote | null;
  xirr: number | null;
  /** Percent change since the previous close (0 without one). */
  dayChangePct: number;
};

export type Totals = {
  value: number;
  invested: number;
  unrealised: number;
  realised: number;
  dividends: number;
  dayChange: number;
  xirr: number | null;
  /** Holdings with units or shares left. */
  count: number;
};

const groupBy = <T>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
};

/** One row per fund that is not archived (or still has units), largest first. */
export function fundRows(portfolio: Portfolio, market: MarketData, today: string): FundRow[] {
  const byFund = groupBy(portfolio.fundTxns, (txn) => txn.fundId);
  return portfolio.funds
    .map((fund) => {
      const txns = byFund.get(fund.id) ?? [];
      const quote = fundQuote(fund, txns, market);
      const position = fundPosition(txns, quote?.price ?? null);
      const dayChange =
        quote?.previous && position.units4
          ? unitsValue(position.units4, quote.price) - unitsValue(position.units4, quote.previous)
          : 0;
      return {
        fund,
        txns,
        position,
        quote,
        xirr: fundXirr(position, today),
        dayChange,
        assetClass: fundAssetClass(fund.category),
        categoryLabel: fundCategoryLabel(fund.category),
      };
    })
    .filter((row) => !row.fund.archived || row.position.units4 > 0)
    .sort((a, b) => b.position.value - a.position.value || a.fund.order - b.fund.order);
}

export function stockRows(portfolio: Portfolio, market: MarketData, today: string): StockRow[] {
  const byStock = groupBy(portfolio.trades, (trade) => trade.stockId);
  return portfolio.stocks
    .map((stock) => {
      const trades = byStock.get(stock.id) ?? [];
      const quote = stockQuote(stock, trades, market);
      const position = stockPosition(trades, quote);
      return {
        stock,
        trades,
        position,
        quote,
        xirr: stockXirr(position, today),
        dayChangePct:
          quote?.previous && quote.source === 'exchange'
            ? ((quote.price - quote.previous) / quote.previous) * 100
            : 0,
      };
    })
    .filter((row) => !row.stock.archived || row.position.quantity > 0)
    .sort((a, b) => b.position.value - a.position.value || a.stock.order - b.stock.order);
}

type Positioned = { position: FundPosition | StockPosition; dayChange?: number };

function totalsOf(rows: Positioned[], today: string, dayChange: number): Totals {
  const flows: CashFlow[] = rows.flatMap((row) => row.position.flows);
  const value = rows.reduce((sum, row) => sum + row.position.value, 0);
  if (value) flows.push({ date: today, amount: value });
  const held = (row: Positioned) =>
    'units4' in row.position ? row.position.units4 > 0 : row.position.quantity > 0;
  return {
    value,
    invested: rows.reduce((sum, row) => sum + row.position.invested, 0),
    unrealised: rows.reduce((sum, row) => sum + row.position.unrealised, 0),
    realised: rows.reduce((sum, row) => sum + row.position.realised, 0),
    dividends: rows.reduce((sum, row) => sum + row.position.dividends, 0),
    dayChange,
    xirr: annualisedReturn(flows, today),
    count: rows.filter(held).length,
  };
}

export const fundTotals = (rows: FundRow[], today: string) =>
  totalsOf(
    rows,
    today,
    rows.reduce((sum, row) => sum + row.dayChange, 0),
  );

export const stockTotals = (rows: StockRow[], today: string) =>
  totalsOf(
    rows,
    today,
    rows.reduce((sum, row) => sum + row.position.dayChange, 0),
  );

export type Slice = { label: string; value: number; share: number };

/** Groups values by label, largest first, with each one's share of the total (%). */
export function allocation(items: { label: string; value: number }[]): Slice[] {
  const sums = new Map<string, number>();
  for (const item of items) {
    if (item.value > 0) sums.set(item.label, (sums.get(item.label) ?? 0) + item.value);
  }
  const whole = [...sums.values()].reduce((sum, value) => sum + value, 0);
  return [...sums.entries()]
    .map(([label, value]) => ({ label, value, share: whole ? (value / whole) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}
