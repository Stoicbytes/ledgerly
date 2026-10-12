import { parseLimitedAmount } from '../expenses/validation';
import { isValidInvestmentDate, parseWhole } from './forms';
import { sharesHeldOn, sortTrades } from './stocks';
import type { Trade, TradeKind } from './types';

/** Largest quantity the database keeps in one trade. */
const MAX_SHARES = 1_000_000_000;

export type TradeDraft = {
  kind: TradeKind;
  date: string;
  quantityText: string;
  priceText: string;
  chargesText: string;
  amountText: string;
  ratioFromText: string;
  ratioToText: string;
  note: string;
};

export type TradeErrors = Partial<
  Record<'date' | 'quantity' | 'price' | 'charges' | 'amount' | 'ratio', string>
>;

export type ValidTrade = Omit<Trade, 'id' | 'createdAt' | 'stockId'>;

export function validateTrade(
  draft: TradeDraft,
  others: Trade[],
): { value: ValidTrade | null; errors: TradeErrors } {
  const errors: TradeErrors = {};
  if (!isValidInvestmentDate(draft.date)) errors.date = 'Pick a date from 1990 to 2100.';
  const base = { kind: draft.kind, date: draft.date, note: draft.note.trim() };
  const empty = {
    quantity: null,
    price: null,
    charges: 0,
    amount: null,
    ratioFrom: null,
    ratioTo: null,
  };
  if (draft.kind === 'dividend') {
    const amount = parseLimitedAmount(draft.amountText);
    if (!amount) errors.amount = 'Enter the dividend received.';
    return Object.keys(errors).length || !amount
      ? { value: null, errors }
      : { value: { ...base, ...empty, amount }, errors };
  }
  if (draft.kind === 'bonus' || draft.kind === 'split') {
    const from = parseWhole(draft.ratioFromText);
    const to = parseWhole(draft.ratioToText);
    if (!from || !to || from > 1000 || to > 1000) errors.ratio = 'Enter the ratio, like 1 : 1.';
    else if (draft.kind === 'split' && from === to)
      errors.ratio = 'A split changes the number of shares.';
    return Object.keys(errors).length || !from || !to
      ? { value: null, errors }
      : covered({ ...base, ...empty, ratioFrom: from, ratioTo: to }, others, errors);
  }
  const quantity = parseWhole(draft.quantityText);
  if (!quantity || quantity > MAX_SHARES) errors.quantity = 'Enter the number of shares.';
  const price = parseLimitedAmount(draft.priceText);
  if (!price) errors.price = 'Enter the price per share.';
  const charges = draft.chargesText.trim() ? parseLimitedAmount(draft.chargesText) : 0;
  if (charges === null) errors.charges = 'Enter the charges, or leave them empty.';
  if (draft.kind === 'sell' && quantity && !errors.date) {
    const held = sharesHeldOn(others, draft.date);
    if (quantity > held) errors.quantity = `Only ${held} shares were held on that date.`;
  }
  if (Object.keys(errors).length || !quantity || !price || charges === null) {
    return { value: null, errors };
  }
  return covered({ ...base, ...empty, quantity, price, charges }, others, errors);
}

function covered(value: ValidTrade, others: Trade[], errors: TradeErrors) {
  const candidate: Trade = {
    ...value,
    id: '~new',
    stockId: '',
    createdAt: Number.MAX_SAFE_INTEGER,
  };
  return keepsSharesCovered([...others, candidate])
    ? { value, errors }
    : { value: null, errors: { quantity: 'This leaves a later sale without enough shares.' } };
}

/** Whether a stock's trades never sell more shares than held (same rule as the database). */
export function keepsSharesCovered(trades: Trade[]): boolean {
  let held = 0;
  for (const trade of sortTrades(trades)) {
    if (trade.kind === 'buy') held += trade.quantity ?? 0;
    else if (trade.kind === 'sell') {
      held -= trade.quantity ?? 0;
      if (held < 0) return false;
    } else if (trade.kind === 'bonus') {
      held += Math.floor((held * (trade.ratioTo ?? 0)) / (trade.ratioFrom || 1));
    } else if (trade.kind === 'split') {
      held = Math.floor((held * (trade.ratioTo ?? 1)) / (trade.ratioFrom || 1));
    }
  }
  return true;
}

/** Symbols as the exchanges write them: capitals, digits and & . _ - (max 30). */
export function normaliseSymbol(input: string): string | null {
  const symbol = input.trim().toUpperCase();
  return /^[A-Z0-9&._-]{1,30}$/.test(symbol) ? symbol : null;
}
