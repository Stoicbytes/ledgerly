import { parseLimitedAmount } from '../expenses/validation';
import { isValidIsoDate } from '../expenses/dates';
import { fromUnits4, roundTo, toUnits4 } from './math';
import { sortFundTxns, unitsHeldOn } from './funds';
import type { FundTxn, FundTxnKind } from './types';

/** The database keeps fund and share dates from 1990 to 2100. */
export const isValidInvestmentDate = (date: string) =>
  isValidIsoDate(date) && date >= '1990-01-01' && date <= '2100-12-31';

/** Largest stamp duty the database accepts (₹10 lakh). */
const MAX_STAMP_DUTY = 100_000_000;

/** Largest SIP instalment the database accepts (₹10 crore). */
export const MAX_SIP_AMOUNT = 10_000_000_000;

/** Parses a positive decimal with up to `places` decimals ("1,234.5678"), else null. */
export function parseDecimal(input: string, places: number): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  const match = new RegExp(`^\\d+(?:\\.\\d{0,${places}})?$`).exec(cleaned);
  if (!match) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? roundTo(value, places) : null;
}

/** Parses a whole number ≥ 1 ("1,200"), else null. */
export function parseWhole(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (!/^\d{1,10}$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value >= 1 && Number.isSafeInteger(value) ? value : null;
}

/**
 * Stamp duty on mutual fund purchases (0.005 % since July 2020) is taken out of the amount
 * paid: duty = amount × 0.005 / 100.005. Shown as a suggestion the user can change.
 */
export const suggestStampDuty = (amount: number) => Math.round((amount * 5) / 100_005);

/**
 * Units allotted for a purchase: (amount − stamp duty) / NAV, to 3 decimals as on
 * statements. Units from the statement can be typed instead.
 */
export function unitsFor(amount: number, stampDuty: number, nav: number): number {
  return nav > 0 ? roundTo((amount - stampDuty) / 100 / nav, 3) : 0;
}

export type FundTxnDraft = {
  kind: FundTxnKind;
  date: string;
  amountText: string;
  stampDutyText: string;
  unitsText: string;
  navText: string;
  note: string;
  sipId: string | null;
};

export type FundTxnErrors = Partial<
  Record<'date' | 'amount' | 'stampDuty' | 'units' | 'nav', string>
>;

export type ValidFundTxn = Omit<FundTxn, 'id' | 'createdAt' | 'fundId'>;

/**
 * Checks a fund transaction. For a sale, the units must be held on that date (the
 * database checks the same; this gives the message before saving). `others` are the
 * fund's other transactions (excluding the one being edited).
 */
export function validateFundTxn(
  draft: FundTxnDraft,
  others: FundTxn[],
): { value: ValidFundTxn | null; errors: FundTxnErrors } {
  const errors: FundTxnErrors = {};
  if (!isValidInvestmentDate(draft.date)) errors.date = 'Pick a date from 1990 to 2100.';
  const amount = parseLimitedAmount(draft.amountText);
  if (!amount) errors.amount = 'Enter the amount, like 5,000.';
  if (draft.kind === 'dividend') {
    if (Object.keys(errors).length || !amount) return { value: null, errors };
    return {
      value: {
        kind: 'dividend',
        date: draft.date,
        amount,
        stampDuty: 0,
        units: null,
        nav: null,
        sipId: null,
        note: draft.note.trim(),
      },
      errors,
    };
  }
  const stampDuty =
    draft.kind === 'buy' && draft.stampDutyText.trim()
      ? parseLimitedAmount(draft.stampDutyText)
      : 0;
  if (stampDuty === null || stampDuty > MAX_STAMP_DUTY)
    errors.stampDuty = 'Enter the stamp duty, or leave it empty.';
  else if (amount && stampDuty >= amount)
    errors.stampDuty = 'Stamp duty must be less than the amount.';
  const nav = parseDecimal(draft.navText, 4);
  if (!nav) errors.nav = 'Enter the NAV, like 58.1234.';
  let units = draft.unitsText.trim() ? parseDecimal(draft.unitsText, 4) : null;
  if (draft.unitsText.trim() && !units) errors.units = 'Enter units, like 86.024.';
  if (!units && amount && nav && stampDuty !== null && !errors.stampDuty) {
    units = unitsFor(amount, stampDuty, nav) || null;
  }
  if (!units && !errors.units) errors.units = 'Enter the units allotted.';
  if (draft.kind === 'sell' && units && !errors.date) {
    const held = unitsHeldOn(others, draft.date);
    if (toUnits4(units) > held) {
      errors.units = `Only ${fromUnits4(held).toFixed(3)} units were held on that date.`;
    }
  }
  if (Object.keys(errors).length || !amount || !nav || !units) return { value: null, errors };
  const value: ValidFundTxn = {
    kind: draft.kind,
    date: draft.date,
    amount,
    stampDuty: draft.kind === 'buy' ? (stampDuty ?? 0) : 0,
    units,
    nav,
    sipId: draft.kind === 'buy' ? draft.sipId : null,
    note: draft.note.trim(),
  };
  const candidate: FundTxn = {
    ...value,
    id: '~new',
    fundId: '',
    createdAt: Number.MAX_SAFE_INTEGER,
  };
  if (!keepsUnitsCovered([...others, candidate])) {
    return {
      value: null,
      errors: { units: 'This leaves a later redemption without enough units.' },
    };
  }
  return { value, errors };
}

/**
 * Whether a fund's transactions never redeem more units than held (the database checks
 * the same after every change). Use it before deleting or changing a transaction.
 */
export function keepsUnitsCovered(txns: FundTxn[]): boolean {
  let held = 0;
  for (const txn of sortFundTxns(txns)) {
    if (txn.kind === 'buy') held += toUnits4(txn.units ?? 0);
    else if (txn.kind === 'sell') {
      held -= toUnits4(txn.units ?? 0);
      if (held < 0) return false;
    }
  }
  return true;
}
