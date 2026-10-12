import { fundAssetClass, replayFund, type RealisedLot } from './funds';
import type { Fund, FundTxn } from './types';

/**
 * Capital gains on fund redemptions, by Indian financial year (April–March), from the
 * first-in-first-out lots each sale used. This classifies gains; it does not compute tax.
 * The rules below are as of the July 2024 budget; the user's CAMS/KFintech capital gains
 * statement is the reference for filing.
 *
 *   * Equity funds: long term when held more than 12 months.
 *   * Debt and other non-equity funds bought on or after 1 April 2023: always taxed at
 *     your slab rate, whatever the holding period.
 *   * Debt funds bought before that: long term after 24 months (36 months for sales
 *     before 23 July 2024).
 *   * Hybrid, index, ETF, solution-oriented and unclassified funds depend on how much of
 *     the fund is in Indian shares, which the app does not know: listed to check.
 */
export type GainType = 'equityShort' | 'equityLong' | 'slab' | 'debtShort' | 'debtLong' | 'check';

export const GAIN_TYPE_LABELS: Record<GainType, string> = {
  equityShort: 'Equity · short term',
  equityLong: 'Equity · long term',
  slab: 'Debt · taxed at your slab',
  debtShort: 'Debt · short term',
  debtLong: 'Debt · long term',
  check: 'To check (hybrid, index or other)',
};

export type GainLine = RealisedLot & { fund: Fund; type: GainType; gain: number; fy: string };

/** "FY 2025-26" for a date in that financial year. */
export function financialYear(date: string): string {
  const year = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 4 ? year : year - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** `date` moved by whole months (same day, or the month's last day). */
function addMonthsTo(date: string, months: number): string {
  const index = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Number(date.slice(8, 10)), last);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Held for more than `months` months. */
const heldOver = (lot: RealisedLot, months: number) =>
  lot.sellDate > addMonthsTo(lot.buyDate, months);

export function gainType(fund: Fund, lot: RealisedLot): GainType {
  const assetClass = fundAssetClass(fund.category);
  if (assetClass === 'Equity') return heldOver(lot, 12) ? 'equityLong' : 'equityShort';
  if (assetClass === 'Debt' || assetClass === 'Gold & silver') {
    if (lot.buyDate >= '2023-04-01') return 'slab';
    return heldOver(lot, lot.sellDate >= '2024-07-23' ? 24 : 36) ? 'debtLong' : 'debtShort';
  }
  return 'check';
}

/** Every redeemed lot of every fund, newest sale first. */
export function gainLines(funds: Fund[], txns: FundTxn[]): GainLine[] {
  return funds
    .flatMap((fund) =>
      replayFund(txns.filter((txn) => txn.fundId === fund.id)).realisedLots.map((lot) => ({
        ...lot,
        fund,
        type: gainType(fund, lot),
        gain: lot.proceeds - lot.cost,
        fy: financialYear(lot.sellDate),
      })),
    )
    .sort((a, b) => b.sellDate.localeCompare(a.sellDate) || a.fund.name.localeCompare(b.fund.name));
}

/** Financial years with at least one sale, newest first. */
export const gainYears = (lines: GainLine[]) => [...new Set(lines.map((line) => line.fy))];

export type GainSummary = {
  type: GainType;
  proceeds: number;
  cost: number;
  gain: number;
  count: number;
};

/** Totals per type for one financial year, in a fixed order, only types that occur. */
export function gainSummary(lines: GainLine[], fy: string): GainSummary[] {
  const order = Object.keys(GAIN_TYPE_LABELS) as GainType[];
  return order
    .map((type) => {
      const own = lines.filter((line) => line.fy === fy && line.type === type);
      return {
        type,
        proceeds: own.reduce((sum, line) => sum + line.proceeds, 0),
        cost: own.reduce((sum, line) => sum + line.cost, 0),
        gain: own.reduce((sum, line) => sum + line.gain, 0),
        count: own.length,
      };
    })
    .filter((summary) => summary.count > 0);
}

/**
 * Yearly exemption on equity long-term gains (₹1.25 lakh for sales from 23 July 2024,
 * ₹1 lakh before). It covers the year's total across all equity funds and shares.
 */
export const equityLtcgExemption = (fy: string) =>
  Number(fy.slice(3, 7)) >= 2024 ? 12_500_000 : 10_000_000;

/** Equity units bought before 1 February 2018: their cost may be raised (grandfathering). */
export const grandfathered = (line: GainLine) =>
  line.type === 'equityLong' && line.buyDate < '2018-02-01';
