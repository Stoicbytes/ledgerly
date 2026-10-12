import {
  daysBetween,
  fromUnits4,
  toUnits4,
  unitsValue,
  annualisedReturn,
  type CashFlow,
} from './math';
import type { Fund, FundTxn, MarketData, Quote } from './types';

/** Same order as the database check: by date, purchases, dividends, then redemptions. */
const RANK: Record<FundTxn['kind'], number> = { buy: 0, dividend: 1, sell: 2 };

export function sortFundTxns(txns: FundTxn[]): FundTxn[] {
  return [...txns].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      RANK[a.kind] - RANK[b.kind] ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  );
}

/** Units still held from one purchase (first in, first out). */
export type FundLot = { date: string; units4: number; cost: number };

/** Units redeemed from one purchase lot, for capital gains. */
export type RealisedLot = {
  buyDate: string;
  sellDate: string;
  units4: number;
  cost: number;
  proceeds: number;
  days: number;
};

export type FundPosition = {
  units4: number;
  /** Cost of the units still held, paise (amount paid incl. stamp duty). */
  invested: number;
  /** Average cost per unit, rupees. */
  avgCost: number;
  value: number;
  unrealised: number;
  /** Gains on units already redeemed (proceeds − FIFO cost). */
  realised: number;
  dividends: number;
  lots: FundLot[];
  realisedLots: RealisedLot[];
  /** Money in and out, for XIRR. */
  flows: CashFlow[];
};

/**
 * Replays a fund's transactions up to `asOf` (inclusive). Redemptions use the oldest
 * units first, which is how capital gains are computed in India. Selling more than is
 * held stops at zero (the database refuses such entries; this only guards old data).
 */
export function replayFund(
  txns: FundTxn[],
  asOf?: string,
): Omit<FundPosition, 'value' | 'unrealised'> {
  const lots: FundLot[] = [];
  const realisedLots: RealisedLot[] = [];
  const flows: CashFlow[] = [];
  let realised = 0;
  let dividends = 0;
  for (const txn of sortFundTxns(txns)) {
    if (asOf && txn.date > asOf) break;
    if (txn.kind === 'buy') {
      lots.push({ date: txn.date, units4: toUnits4(txn.units ?? 0), cost: txn.amount });
      flows.push({ date: txn.date, amount: -txn.amount });
    } else if (txn.kind === 'dividend') {
      dividends += txn.amount;
      flows.push({ date: txn.date, amount: txn.amount });
    } else {
      flows.push({ date: txn.date, amount: txn.amount });
      let remaining = toUnits4(txn.units ?? 0);
      const sold = remaining;
      let proceedsLeft = txn.amount;
      while (remaining > 0 && lots.length) {
        const lot = lots[0];
        const take = Math.min(lot.units4, remaining);
        const cost = take === lot.units4 ? lot.cost : Math.round((lot.cost * take) / lot.units4);
        const proceeds = take === remaining ? proceedsLeft : Math.round((txn.amount * take) / sold);
        realisedLots.push({
          buyDate: lot.date,
          sellDate: txn.date,
          units4: take,
          cost,
          proceeds,
          days: daysBetween(lot.date, txn.date),
        });
        realised += proceeds - cost;
        proceedsLeft -= proceeds;
        lot.units4 -= take;
        lot.cost -= cost;
        remaining -= take;
        if (lot.units4 === 0) lots.shift();
      }
    }
  }
  const units4 = lots.reduce((sum, lot) => sum + lot.units4, 0);
  const invested = lots.reduce((sum, lot) => sum + lot.cost, 0);
  return {
    units4,
    invested,
    avgCost: units4 ? invested / 100 / fromUnits4(units4) : 0,
    realised,
    dividends,
    lots,
    realisedLots,
    flows,
  };
}

export function fundPosition(txns: FundTxn[], nav: number | null, asOf?: string): FundPosition {
  const base = replayFund(txns, asOf);
  const value = nav ? unitsValue(base.units4, nav) : 0;
  return { ...base, value, unrealised: nav ? value - base.invested : 0 };
}

/** Units held on a date (for validating a redemption before it is saved). */
export const unitsHeldOn = (txns: FundTxn[], date: string) => replayFund(txns, date).units4;

const latestBefore = (points: [string, number][] | undefined, date: string) => {
  if (!points) return null;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index][0] < date) return points[index][1];
  }
  return null;
};

/**
 * The NAV used to value a fund: the newest of the AMFI NAV and a manual NAV, else the
 * NAV of the latest entry. `previous` (for the day change) only comes from AMFI history.
 */
export function fundQuote(fund: Fund, txns: FundTxn[], market: MarketData): Quote | null {
  const scheme = fund.schemeCode ? market.schemes[String(fund.schemeCode)] : undefined;
  const amfi =
    scheme?.nav && scheme.navDate
      ? {
          price: scheme.nav,
          date: scheme.navDate,
          source: 'amfi' as const,
          previous: latestBefore(market.navHistory[String(fund.schemeCode)], scheme.navDate),
        }
      : null;
  const manual =
    fund.manualNav && fund.manualNavDate
      ? {
          price: fund.manualNav,
          date: fund.manualNavDate,
          source: 'manual' as const,
          previous: null,
        }
      : null;
  if (amfi && manual) return manual.date > amfi.date ? manual : amfi;
  if (amfi || manual) return amfi ?? manual;
  const last = sortFundTxns(txns.filter((txn) => txn.nav)).pop();
  return last?.nav
    ? { price: last.nav, date: last.date, source: 'last entry', previous: null }
    : null;
}

/** NAV on a date from stored history (the last one on or before it), else null. */
export function navOn(market: MarketData, schemeCode: number | null, date: string): number | null {
  if (!schemeCode) return null;
  const points = market.navHistory[String(schemeCode)];
  if (!points) return null;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index][0] <= date) return points[index][1];
  }
  return null;
}

/** Broad asset class from the AMFI category ("Equity Scheme - Mid Cap Fund" → Equity). */
export function fundAssetClass(category: string): string {
  const text = category.toLowerCase();
  if (text.startsWith('equity') || text.includes('elss')) return 'Equity';
  if (text.startsWith('debt') || text.includes('income') || text.includes('liquid')) return 'Debt';
  if (text.startsWith('hybrid')) return 'Hybrid';
  if (text.includes('gold') || text.includes('silver')) return 'Gold & silver';
  if (text.includes('index') || text.includes('etf')) return 'Index & ETF';
  if (text.startsWith('solution')) return 'Solution oriented';
  return category.trim() ? 'Other' : 'Unclassified';
}

/** Short category label ("Equity Scheme - Large Cap Fund" → "Large Cap Fund"). */
export function fundCategoryLabel(category: string): string {
  const parts = category.split(' - ');
  return (parts.length > 1 ? parts.slice(1).join(' - ') : category).trim() || 'Unclassified';
}

export function fundXirr(position: FundPosition, asOf: string): number | null {
  const flows = [...position.flows];
  if (position.value) flows.push({ date: asOf, amount: position.value });
  return annualisedReturn(flows, asOf);
}
