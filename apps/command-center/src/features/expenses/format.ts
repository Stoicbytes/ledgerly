import { monthLabel, monthOf, type DateRange } from '@/lib/domain/expenses';
import {
  formatAxisMoney,
  formatMoney,
  formatMoneyWhole,
  moneyAccessibilityLabel,
  type SignDisplay,
} from '@/lib/formatting/currency';

/** Entry amounts read like a ledger: "₹120" when there are no paise, else "₹120.50". */
export function formatEntry(minor: number, signDisplay: SignDisplay = 'auto'): string {
  return minor % 100 === 0
    ? formatMoneyWhole(minor, signDisplay)
    : formatMoney(minor, { signDisplay });
}

export function speakEntry(minor: number, signDisplay: SignDisplay = 'auto'): string {
  return moneyAccessibilityLabel(minor, { signDisplay, whole: minor % 100 === 0 });
}

/** Compact signed label for calendar cells: "+₹10K", "−₹150". */
export function signedCompact(minor: number, sign: '+' | '−'): string {
  return `${sign}${formatAxisMoney(Math.abs(minor))}`;
}

/** "vs 1–7 Sep" while a month is in progress, "vs Sep" once it is over. */
export function comparisonLabel(base: DateRange, month: string, today: string): string {
  const name = monthLabel(monthOf(base.start), 'short');
  if (monthOf(today) !== month) return `vs ${name}`;
  return `vs ${Number(base.start.slice(8))}–${Number(base.end.slice(8))} ${name}`;
}
