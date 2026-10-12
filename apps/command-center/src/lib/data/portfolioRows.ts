import type { Fund, FundTxn, Portfolio, Sip, Stock, Trade } from '@/lib/domain/investments';
import { diffById, type CollectionDiff } from '@/lib/domain/sync';

/** Mapping between the investment tables (migration 0007) and the app's types. */

type Row = Record<string, unknown>;
export type RemotePortfolio = Partial<
  Record<'mf_funds' | 'mf_sips' | 'mf_transactions' | 'stocks' | 'stock_trades', Row[]>
>;

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const numOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const strOrNull = (value: unknown) => (typeof value === 'string' && value ? value : null);
const time = (value: unknown) => {
  const parsed = Date.parse(str(value));
  return Number.isFinite(parsed) ? parsed : 0;
};
const isoTime = (ms: number) => new Date(ms || Date.now()).toISOString();

export function portfolioFromRemote(raw: RemotePortfolio): Portfolio {
  return {
    funds: (raw.mf_funds ?? []).map((row) => ({
      id: str(row.id),
      schemeCode: numOrNull(row.scheme_code),
      isin: strOrNull(row.isin),
      name: str(row.name),
      category: str(row.category),
      fundHouse: str(row.fund_house),
      folio: str(row.folio),
      manualNav: numOrNull(row.manual_nav),
      manualNavDate: strOrNull(row.manual_nav_date),
      note: str(row.note),
      archived: row.archived === true,
      order: num(row.sort_order),
      createdAt: time(row.created_at),
      expenseRatio: numOrNull(row.expense_ratio),
      goalId: strOrNull(row.goal_id),
    })),
    sips: (raw.mf_sips ?? []).map((row) => ({
      id: str(row.id),
      fundId: str(row.fund_id),
      amount: num(row.amount),
      day: num(row.day_of_month),
      startDate: str(row.start_date),
      endDate: strOrNull(row.end_date),
      active: row.active !== false,
      note: str(row.note),
      createdAt: time(row.created_at),
      stepUpPct: num(row.step_up_pct),
    })),
    fundTxns: (raw.mf_transactions ?? []).map((row) => ({
      id: str(row.id),
      fundId: str(row.fund_id),
      kind: str(row.kind) as FundTxn['kind'],
      date: str(row.trade_date),
      amount: num(row.amount),
      stampDuty: num(row.stamp_duty),
      units: numOrNull(row.units),
      nav: numOrNull(row.nav),
      sipId: strOrNull(row.sip_id),
      note: str(row.note),
      createdAt: time(row.created_at),
    })),
    stocks: (raw.stocks ?? []).map((row) => ({
      id: str(row.id),
      isin: strOrNull(row.isin),
      symbol: str(row.symbol),
      exchange: (str(row.exchange) || 'NSE') as Stock['exchange'],
      name: str(row.name),
      sector: str(row.sector),
      manualPrice: numOrNull(row.manual_price),
      manualPriceDate: strOrNull(row.manual_price_date),
      note: str(row.note),
      archived: row.archived === true,
      order: num(row.sort_order),
      createdAt: time(row.created_at),
    })),
    trades: (raw.stock_trades ?? []).map((row) => ({
      id: str(row.id),
      stockId: str(row.stock_id),
      kind: str(row.kind) as Trade['kind'],
      date: str(row.trade_date),
      quantity: numOrNull(row.quantity),
      price: numOrNull(row.price),
      charges: num(row.charges),
      amount: numOrNull(row.amount),
      ratioFrom: numOrNull(row.ratio_from),
      ratioTo: numOrNull(row.ratio_to),
      note: str(row.note),
      createdAt: time(row.created_at),
    })),
  };
}

const fundRow = (f: Fund) => ({
  id: f.id,
  scheme_code: f.schemeCode,
  isin: f.isin,
  name: f.name,
  category: f.category,
  fund_house: f.fundHouse,
  folio: f.folio,
  manual_nav: f.manualNav,
  manual_nav_date: f.manualNavDate,
  note: f.note,
  archived: f.archived,
  sort_order: f.order,
  // Migration 0013; an older database ignores these keys.
  expense_ratio: f.expenseRatio ?? null,
  goal_id: f.goalId ?? null,
  created_at: isoTime(f.createdAt),
});
const sipRow = (s: Sip) => ({
  id: s.id,
  fund_id: s.fundId,
  amount: s.amount,
  day_of_month: s.day,
  start_date: s.startDate,
  end_date: s.endDate,
  active: s.active,
  note: s.note,
  step_up_pct: s.stepUpPct ?? 0,
  created_at: isoTime(s.createdAt),
});
const txnRow = (t: FundTxn) => ({
  id: t.id,
  fund_id: t.fundId,
  kind: t.kind,
  trade_date: t.date,
  amount: t.amount,
  stamp_duty: t.stampDuty,
  units: t.units,
  nav: t.nav,
  sip_id: t.sipId,
  note: t.note,
  created_at: isoTime(t.createdAt),
});
const stockRow = (s: Stock) => ({
  id: s.id,
  isin: s.isin,
  symbol: s.symbol,
  exchange: s.exchange,
  name: s.name,
  sector: s.sector,
  manual_price: s.manualPrice,
  manual_price_date: s.manualPriceDate,
  note: s.note,
  archived: s.archived,
  sort_order: s.order,
  created_at: isoTime(s.createdAt),
});
const tradeRow = (t: Trade) => ({
  id: t.id,
  stock_id: t.stockId,
  kind: t.kind,
  trade_date: t.date,
  quantity: t.quantity,
  price: t.price,
  charges: t.charges,
  amount: t.amount,
  ratio_from: t.ratioFrom,
  ratio_to: t.ratioTo,
  note: t.note,
  created_at: isoTime(t.createdAt),
});

export type PortfolioChanges = {
  upserts: Record<
    'mf_funds' | 'mf_sips' | 'mf_transactions' | 'stocks' | 'stock_trades',
    unknown[]
  >;
  deletes: Record<'mf_funds' | 'mf_sips' | 'mf_transactions' | 'stocks' | 'stock_trades', string[]>;
  diffs: CollectionDiff<unknown>[];
};

/** Rows to save and ids to delete between two copies of the portfolio. */
export function portfolioChanges(previous: Portfolio, next: Portfolio): PortfolioChanges {
  const funds = diffById(previous.funds, next.funds, fundRow);
  const sips = diffById(previous.sips, next.sips, sipRow);
  const txns = diffById(previous.fundTxns, next.fundTxns, txnRow);
  const stocks = diffById(previous.stocks, next.stocks, stockRow);
  const trades = diffById(previous.trades, next.trades, tradeRow);
  return {
    upserts: {
      mf_funds: funds.upserts.map(fundRow),
      mf_sips: sips.upserts.map(sipRow),
      mf_transactions: txns.upserts.map(txnRow),
      stocks: stocks.upserts.map(stockRow),
      stock_trades: trades.upserts.map(tradeRow),
    },
    deletes: {
      mf_funds: funds.deletes,
      mf_sips: sips.deletes,
      mf_transactions: txns.deletes,
      stocks: stocks.deletes,
      stock_trades: trades.deletes,
    },
    diffs: [funds, sips, txns, stocks, trades],
  };
}
