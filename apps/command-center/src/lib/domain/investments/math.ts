import { parseIsoDate } from '../expenses/dates';

/**
 * Units are kept as integers of ten-thousandths (4 decimals, as stored), so adding and
 * splitting lots never drifts. NAVs are rupees per unit; value = units × NAV in paise.
 */
const UNIT_SCALE = 10_000;

export const toUnits4 = (units: number) => Math.round(units * UNIT_SCALE);
export const fromUnits4 = (units4: number) => units4 / UNIT_SCALE;

/** Paise value of `units4` at `nav` rupees per unit. */
export const unitsValue = (units4: number, nav: number) =>
  Math.round((units4 * Math.round(nav * UNIT_SCALE)) / ((UNIT_SCALE * UNIT_SCALE) / 100));

/** Rounds to `places` decimals (display and input normalisation). */
export const roundTo = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const DAY_MS = 86_400_000;

export const daysBetween = (from: string, to: string) =>
  Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);

export type CashFlow = { date: string; amount: number };

/** A year of history before a return is annualised. */
const XIRR_MIN_DAYS = 365;

/**
 * XIRR once the first money went in at least a year before `asOf`; null before that.
 * Annualising a few weeks blows small moves up (2 % in a month reads as 27 % a year),
 * so, like fund statements, younger holdings show only their gain on cost.
 */
export function annualisedReturn(flows: CashFlow[], asOf: string): number | null {
  const dated = flows.filter((flow) => flow.amount !== 0);
  if (!dated.length) return null;
  const first = dated.reduce((min, flow) => (flow.date < min ? flow.date : min), dated[0].date);
  return daysBetween(first, asOf) >= XIRR_MIN_DAYS ? xirr(flows) : null;
}

/**
 * Annualised internal rate of return for irregular cash flows (XIRR), as a fraction
 * (0.12 = 12 %). Money paid in is negative, money out (and today's value) positive.
 * Returns null when it is not defined: no inflow or no outflow, or no solution.
 */
export function xirr(flows: CashFlow[]): number | null {
  const items = flows.filter((flow) => flow.amount !== 0);
  if (!items.some((flow) => flow.amount > 0) || !items.some((flow) => flow.amount < 0)) {
    return null;
  }
  const start = items.reduce((min, flow) => (flow.date < min ? flow.date : min), items[0].date);
  const years = items.map((flow) => daysBetween(start, flow.date) / 365);
  const npv = (rate: number) =>
    items.reduce((sum, flow, index) => sum + flow.amount / (1 + rate) ** years[index], 0);
  const slope = (rate: number) =>
    items.reduce(
      (sum, flow, index) => sum - (years[index] * flow.amount) / (1 + rate) ** (years[index] + 1),
      0,
    );
  const scale = Math.max(...items.map((flow) => Math.abs(flow.amount)));
  const tolerance = scale * 1e-9;

  // Newton's method from 10 %, then bisection if it wanders off.
  let rate = 0.1;
  for (let step = 0; step < 50; step += 1) {
    const value = npv(rate);
    if (Math.abs(value) < tolerance) return rate;
    const derivative = slope(rate);
    if (!derivative || !Number.isFinite(derivative)) break;
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }
  let low = -0.9999;
  let high = 100;
  let lowValue = npv(low);
  if (lowValue * npv(high) > 0) return null;
  for (let step = 0; step < 300; step += 1) {
    const mid = (low + high) / 2;
    const value = npv(mid);
    if (Math.abs(value) < tolerance || high - low < 1e-9) return mid;
    if (value * lowValue > 0) {
      low = mid;
      lowValue = value;
    } else high = mid;
  }
  return (low + high) / 2;
}
