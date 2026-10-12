/**
 * Investments domain model (mutual funds and stocks). Mirrors migration 0007.
 * Money is integer paise. Fund units and NAVs are decimals with up to 4 places (exact
 * in the database; calculations here work in ten-thousandths of a unit, see math.ts).
 * Dates are calendar dates (YYYY-MM-DD).
 */

export type Fund = {
  id: string;
  /** AMFI scheme code when picked from the list; null for a fund entered by hand. */
  schemeCode: number | null;
  /** Growth-option ISIN, as in tradebooks and statements; matches imported trades. */
  isin: string | null;
  name: string;
  /** AMFI category, e.g. "Equity Scheme - Large Cap Fund". */
  category: string;
  fundHouse: string;
  folio: string;
  /** Rupees per unit, used when there is no AMFI NAV. */
  manualNav: number | null;
  manualNavDate: string | null;
  note: string;
  archived: boolean;
  order: number;
  createdAt: number;
  /** Yearly expense ratio (TER) in percent, from the factsheet (migration 0013). */
  expenseRatio?: number | null;
  /** The goal this fund is for (migration 0013). */
  goalId?: string | null;
};

/** buy: lump sum, SIP instalment, switch in, reinvested dividend. sell: redemption, switch out. */
export type FundTxnKind = 'buy' | 'sell' | 'dividend';

export type FundTxn = {
  id: string;
  fundId: string;
  kind: FundTxnKind;
  /** NAV (allotment) date. */
  date: string;
  /** Paise. buy: paid including stamp duty; sell: proceeds; dividend: paid out. */
  amount: number;
  stampDuty: number;
  /** null for dividends. */
  units: number | null;
  /** Rupees per unit; null for dividends. */
  nav: number | null;
  sipId: string | null;
  note: string;
  createdAt: number;
};

export type Sip = {
  id: string;
  fundId: string;
  /** Paise per instalment (monthly). */
  amount: number;
  /** 1–28. */
  day: number;
  startDate: string;
  endDate: string | null;
  active: boolean;
  note: string;
  createdAt: number;
  /** Yearly increase of the instalment in percent, from the start date (migration 0013). */
  stepUpPct?: number;
};

export type Exchange = 'NSE' | 'BSE';

export type Stock = {
  id: string;
  isin: string | null;
  symbol: string;
  exchange: Exchange;
  name: string;
  sector: string;
  /** Paise per share, used when there is no exchange price. */
  manualPrice: number | null;
  manualPriceDate: string | null;
  note: string;
  archived: boolean;
  order: number;
  createdAt: number;
};

/**
 * bonus: ratioTo new shares for every ratioFrom held. split: ratioFrom shares become
 * ratioTo. Whole shares only (fractions are paid in cash), rounded down.
 */
export type TradeKind = 'buy' | 'sell' | 'bonus' | 'split' | 'dividend';

export type Trade = {
  id: string;
  stockId: string;
  kind: TradeKind;
  date: string;
  quantity: number | null;
  /** Paise per share. */
  price: number | null;
  /** Brokerage and taxes, paise. */
  charges: number;
  /** Dividend received, paise. */
  amount: number | null;
  ratioFrom: number | null;
  ratioTo: number | null;
  note: string;
  createdAt: number;
};

export type Portfolio = {
  funds: Fund[];
  fundTxns: FundTxn[];
  sips: Sip[];
  stocks: Stock[];
  trades: Trade[];
};

/** [date, value] points, oldest first. NAVs in rupees; share prices in paise. */
export type Series = [string, number][];

export type SchemeQuote = {
  name: string;
  fundHouse: string;
  category: string;
  nav: number | null;
  navDate: string | null;
};

export type SecurityQuote = {
  symbol: string;
  name: string;
  exchange: Exchange;
  /** Paise. */
  close: number | null;
  prevClose: number | null;
  priceDate: string | null;
};

export type RefreshRun = {
  source: 'amfi' | 'nse' | 'bse' | 'mfapi';
  status: 'ok' | 'failed';
  finishedAt: string | null;
  dataDate: string | null;
  message: string;
};

/** Public prices for the user's holdings (from load_market). */
export type MarketData = {
  schemes: Record<string, SchemeQuote>;
  navHistory: Record<string, Series>;
  securities: Record<string, SecurityQuote>;
  priceHistory: Record<string, Series>;
  runs: RefreshRun[];
};

export const EMPTY_MARKET: MarketData = {
  schemes: {},
  navHistory: {},
  securities: {},
  priceHistory: {},
  runs: [],
};

export const EMPTY_PORTFOLIO: Portfolio = {
  funds: [],
  fundTxns: [],
  sips: [],
  stocks: [],
  trades: [],
};

/** Where a valuation price came from (shown next to it). */
export type PriceSource = 'amfi' | 'exchange' | 'manual' | 'last entry';

export type Quote = { price: number; date: string; source: PriceSource; previous: number | null };
