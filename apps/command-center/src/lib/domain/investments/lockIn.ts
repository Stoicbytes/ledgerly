import type { FundLot } from './funds';
import type { Fund } from './types';

/** "2028-03-10" three years after "2025-03-10" (29 February moves to 28 February). */
const threeYearsOn = (date: string) => {
  const year = Number(date.slice(0, 4)) + 3;
  const day = date.slice(5) === '02-29' ? '02-28' : date.slice(5);
  return `${year}-${day}`;
};

export const isElss = (fund: Fund) => /\belss\b/i.test(fund.category);

/**
 * ELSS units still in their three-year lock-in on `today` (each purchase, SIP instalments
 * included, is locked for three years from its own date), and the day the last of them is
 * free. Null for other funds or when nothing is locked.
 */
export function elssLocked(
  fund: Fund,
  lots: FundLot[],
  today: string,
): { units4: number; until: string } | null {
  if (!isElss(fund)) return null;
  const locked = lots.filter((lot) => threeYearsOn(lot.date) > today);
  if (!locked.length) return null;
  return {
    units4: locked.reduce((sum, lot) => sum + lot.units4, 0),
    until: locked.map((lot) => threeYearsOn(lot.date)).sort()[locked.length - 1],
  };
}
