import type { FundRow } from './portfolio';

/** What a yearly expense ratio (percent) costs on a value, paise per year. */
export const yearlyCost = (value: number, expenseRatio: number) =>
  Math.round((value * expenseRatio) / 100);

/** Parses an expense ratio like "0.45" or "1.2 %" (0–5, up to two decimals), else null. */
export function parseExpenseRatio(input: string): number | null {
  const match = /^(\d)(?:\.(\d{1,2}))?$/.exec(input.replace(/[%\s]/g, ''));
  if (!match) return null;
  const value = Number(`${match[1]}.${match[2] ?? '0'}`);
  return value <= 5 ? value : null;
}

export type FundCosts = {
  /** Paise per year across funds with an expense ratio. */
  total: number;
  /** Value-weighted average expense ratio of those funds, percent. */
  average: number | null;
  rows: { row: FundRow; cost: number }[];
  /** Funds with units whose expense ratio is not entered yet. */
  missing: FundRow[];
};

export function fundCosts(rows: FundRow[]): FundCosts {
  const held = rows.filter((row) => row.position.units4 > 0);
  const priced = held.filter((row) => row.fund.expenseRatio != null);
  const costed = priced.map((row) => ({
    row,
    cost: yearlyCost(row.position.value, row.fund.expenseRatio ?? 0),
  }));
  const total = costed.reduce((sum, item) => sum + item.cost, 0);
  const value = priced.reduce((sum, row) => sum + row.position.value, 0);
  return {
    total,
    average: value ? (total / value) * 100 : null,
    rows: costed.sort((a, b) => b.cost - a.cost),
    missing: held.filter((row) => row.fund.expenseRatio == null),
  };
}

/**
 * Funds you hold in the same SEBI category (two large-cap funds, say). Funds in one
 * category pick from the same set of shares, so they often overlap. A hint from the
 * category only: the app does not know the funds' actual holdings.
 */
export function similarFunds(rows: FundRow[]): { category: string; rows: FundRow[] }[] {
  const groups = new Map<string, FundRow[]>();
  for (const row of rows) {
    if (row.position.units4 <= 0 || !row.fund.category.trim()) continue;
    if (/index|etf|fund of funds|fof/i.test(row.fund.category)) continue;
    const list = groups.get(row.categoryLabel) ?? [];
    groups.set(row.categoryLabel, [...list, row]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([category, list]) => ({ category, rows: list }))
    .sort((a, b) => b.rows.length - a.rows.length);
}
