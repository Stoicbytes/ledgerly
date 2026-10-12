import { annualisedReturn, daysBetween, type CashFlow } from './math';
import type { Series } from './types';

/**
 * What your shares would be worth had the same money gone into an index fund instead:
 * each buy puts the same amount into the fund at that day's NAV, and each sale or
 * dividend takes the same amount out (a "public market equivalent"). The fund's NAV
 * already reflects its costs and reinvested dividends, so this compares with something
 * you could actually have bought.
 */
export type BenchmarkComparison =
  | { status: 'empty' }
  /** A trade is older than the fund's NAV history (or falls in a gap of it). */
  | { status: 'noHistory'; firstNavDate: string | null; firstTradeDate: string }
  | {
      status: 'ok';
      /** Your shares today, and what the same money in the fund is worth. */
      yourValue: number;
      indexValue: number;
      /** Put in (buys) and taken out (sales after charges, dividends), paise. */
      invested: number;
      withdrawn: number;
      yourXirr: number | null;
      indexXirr: number | null;
      navDate: string;
      /**
       * A sale took out more than the fund holding had left (your shares grew faster);
       * the fund holding is counted as zero from then on.
       */
      exhausted: boolean;
    };

/** A NAV is used for a date when it was published that day or up to 10 days before. */
const NAV_LOOKBACK_DAYS = 10;

/** The NAV in force on `date` from an ascending series, or null. */
export function navInForce(history: Series, date: string): number | null {
  let low = 0;
  let high = history.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (history[middle][0] <= date) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  if (found < 0) return null;
  const [navDate, nav] = history[found];
  return daysBetween(navDate, date) <= NAV_LOOKBACK_DAYS ? nav : null;
}

export function compareWithIndex(
  flows: CashFlow[],
  yourValue: number,
  history: Series,
  today: string,
): BenchmarkComparison {
  const dated = flows
    .filter((flow) => flow.amount !== 0 && flow.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = history[history.length - 1];
  if (!dated.length) return { status: 'empty' };
  let units = 0;
  let invested = 0;
  let withdrawn = 0;
  let exhausted = false;
  for (const flow of dated) {
    const nav = navInForce(history, flow.date);
    if (!nav || !latest) {
      return {
        status: 'noHistory',
        firstNavDate: history[0]?.[0] ?? null,
        firstTradeDate: dated[0].date,
      };
    }
    if (flow.amount < 0) {
      units += -flow.amount / nav;
      invested += -flow.amount;
    } else {
      const redeem = flow.amount / nav;
      if (redeem > units * (1 + 1e-9)) exhausted = true;
      units = Math.max(0, units - redeem);
      withdrawn += flow.amount;
    }
  }
  const indexValue = Math.round(units * latest[1]);
  const withValue = (value: number) => (value ? [...dated, { date: today, amount: value }] : dated);
  return {
    status: 'ok',
    yourValue,
    indexValue,
    invested,
    withdrawn,
    yourXirr: annualisedReturn(withValue(yourValue), today),
    indexXirr: annualisedReturn(withValue(indexValue), today),
    navDate: latest[0],
    exhausted,
  };
}
