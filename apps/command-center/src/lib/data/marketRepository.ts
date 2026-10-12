import type { MarketData, RefreshRun, Series } from '@/lib/domain/investments';
import { callFunction, callRpc } from './rpc';

/**
 * Public market prices for the signed-in user's holdings, read from the market tables
 * (migration 0007). The prices themselves are downloaded on the server by the
 * market-refresh Edge Function; the app never contacts AMFI or the exchanges.
 */
type Row = Record<string, unknown>;

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const numOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
const strOrNull = (value: unknown) => (typeof value === 'string' && value ? value : null);

function series(raw: unknown): Series {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((point): Series => {
    if (!Array.isArray(point)) return [];
    const date = str(point[0]).slice(0, 10);
    const value = numOrNull(point[1]);
    return date && value ? [[date, value]] : [];
  });
}

const seriesMap = (raw: unknown): Record<string, Series> =>
  raw && typeof raw === 'object'
    ? Object.fromEntries(Object.entries(raw as Row).map(([key, value]) => [key, series(value)]))
    : {};

export function marketFromRemote(raw: Row | null): MarketData {
  const data = raw ?? {};
  const schemes = Array.isArray(data.schemes) ? (data.schemes as Row[]) : [];
  const securities = Array.isArray(data.securities) ? (data.securities as Row[]) : [];
  const runs = Array.isArray(data.runs) ? (data.runs as Row[]) : [];
  return {
    schemes: Object.fromEntries(
      schemes.map((row) => [
        String(row.scheme_code),
        {
          name: str(row.name),
          fundHouse: str(row.fund_house),
          category: str(row.category),
          nav: numOrNull(row.nav),
          navDate: strOrNull(row.nav_date),
        },
      ]),
    ),
    navHistory: seriesMap(data.nav_history),
    securities: Object.fromEntries(
      securities.map((row) => [
        str(row.isin),
        {
          symbol: str(row.symbol),
          name: str(row.name),
          exchange: str(row.exchange) === 'BSE' ? ('BSE' as const) : ('NSE' as const),
          close: numOrNull(row.close),
          prevClose: numOrNull(row.prev_close),
          priceDate: strOrNull(row.price_date),
        },
      ]),
    ),
    priceHistory: seriesMap(data.price_history),
    runs: runs.map((row) => ({
      source: str(row.source) as RefreshRun['source'],
      status: str(row.status) === 'ok' ? ('ok' as const) : ('failed' as const),
      finishedAt: strOrNull(row.finished_at),
      dataDate: strOrNull(row.data_date),
      message: str(row.message),
    })),
  };
}

export async function loadMarket(): Promise<MarketData> {
  return marketFromRemote(await callRpc<Row>('load_market'));
}

export type FundMatch = {
  schemeCode: number;
  /** Growth-option ISIN (null until migration 0009 returns it). */
  isin: string | null;
  name: string;
  fundHouse: string;
  category: string;
  nav: number | null;
  navDate: string | null;
};

/** AMFI schemes whose name has every word of `query` (or the exact scheme code). */
export async function searchFunds(query: string): Promise<FundMatch[]> {
  const rows = await callRpc<Row[]>('search_funds', { p_query: query });
  return (rows ?? []).map((row) => ({
    schemeCode: Number(row.scheme_code),
    isin: strOrNull(row.isin),
    name: str(row.name),
    fundHouse: str(row.fund_house),
    category: str(row.category),
    nav: numOrNull(row.nav),
    navDate: strOrNull(row.nav_date),
  }));
}

export type SecurityMatch = {
  isin: string;
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  close: number | null;
  priceDate: string | null;
};

export async function searchSecurities(query: string): Promise<SecurityMatch[]> {
  const rows = await callRpc<Row[]>('search_securities', { p_query: query });
  return (rows ?? []).map((row) => ({
    isin: str(row.isin),
    symbol: str(row.symbol),
    name: str(row.name),
    exchange: str(row.exchange) === 'BSE' ? 'BSE' : 'NSE',
    close: numOrNull(row.close),
    priceDate: strOrNull(row.price_date),
  }));
}

/** The NAV published on `date` (or the last one in the 10 days before), from history. */
export async function navOnDate(
  schemeCode: number,
  date: string,
): Promise<{ nav: number; date: string } | null> {
  const row = await callRpc<Row | null>('nav_on', { p_scheme_code: schemeCode, p_date: date });
  const nav = numOrNull(row?.nav);
  const navDate = strOrNull(row?.nav_date);
  return nav && navDate ? { nav, date: navDate } : null;
}

export type RefreshOutcome = {
  status: 'ok' | 'failed' | 'current';
  rows?: number;
  dataDate?: string | null;
  message?: string;
};
export type RefreshResult = {
  navs?: RefreshOutcome;
  prices?: RefreshOutcome;
  history?: RefreshOutcome;
  busy?: boolean;
};

/** Asks the server to fetch the latest NAVs and closing prices (at most every 30 minutes). */
export async function refreshMarket(): Promise<RefreshResult> {
  return (await callFunction<RefreshResult>('market-refresh')) ?? {};
}
