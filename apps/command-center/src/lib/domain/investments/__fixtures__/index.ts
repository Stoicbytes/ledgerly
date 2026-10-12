import type { Fund, FundTxn, Sip, Stock, Trade } from '../types';

let created = 0;

export const fund = (patch: Partial<Fund> = {}): Fund => ({
  id: 'f1',
  schemeCode: 120465,
  isin: null,
  name: 'Horizon Bluechip Fund - Direct - Growth',
  category: 'Equity Scheme - Large Cap Fund',
  fundHouse: 'Horizon Mutual Fund',
  folio: '',
  manualNav: null,
  manualNavDate: null,
  note: '',
  archived: false,
  order: 0,
  createdAt: 0,
  ...patch,
});

export const buy = (
  date: string,
  amount: number,
  units: number,
  nav: number,
  patch: Partial<FundTxn> = {},
): FundTxn => ({
  id: `t${(created += 1)}`,
  fundId: 'f1',
  kind: 'buy',
  date,
  amount,
  stampDuty: 0,
  units,
  nav,
  sipId: null,
  note: '',
  createdAt: created,
  ...patch,
});

export const sell = (
  date: string,
  amount: number,
  units: number,
  nav: number,
  patch: Partial<FundTxn> = {},
): FundTxn => ({
  ...buy(date, amount, units, nav, patch),
  kind: 'sell',
  ...patch,
});

export const sip = (patch: Partial<Sip> = {}): Sip => ({
  id: 's1',
  fundId: 'f1',
  amount: 500000,
  day: 5,
  startDate: '2026-01-05',
  endDate: null,
  active: true,
  note: '',
  createdAt: 0,
  ...patch,
});

export const stock = (patch: Partial<Stock> = {}): Stock => ({
  id: 'k1',
  isin: 'INE002A01018',
  symbol: 'RELIANCE',
  exchange: 'NSE',
  name: 'Reliance Industries',
  sector: 'Energy',
  manualPrice: null,
  manualPriceDate: null,
  note: '',
  archived: false,
  order: 0,
  createdAt: 0,
  ...patch,
});

export const trade = (kind: Trade['kind'], date: string, patch: Partial<Trade> = {}): Trade => ({
  id: `r${(created += 1)}`,
  stockId: 'k1',
  kind,
  date,
  quantity: null,
  price: null,
  charges: 0,
  amount: null,
  ratioFrom: null,
  ratioTo: null,
  note: '',
  createdAt: created,
  ...patch,
});
