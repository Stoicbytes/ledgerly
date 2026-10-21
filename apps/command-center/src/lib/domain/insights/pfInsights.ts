import { monthLabel } from '../expenses/dates';
import { financialYear } from '../investments/capitalGains';
import {
  fyStartYear,
  pfBalance,
  yearsWithoutInterest,
  type Payslip,
  type PfEntry,
} from '../salary';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import type { Insight } from './types';

/** How many of the newest payslips are checked for a missing employer share. */
const RECENT_SLIPS = 3;

/**
 * PF lines for the home screen: interest not entered for finished years, the employer share
 * missing on recent payslips, and how much the balance grew this financial year.
 */
export function pfInsights(
  entries: readonly PfEntry[],
  payslips: readonly Payslip[],
  today: string,
): Insight[] {
  const items: Insight[] = [];
  const missing = yearsWithoutInterest(entries, today);
  if (missing.length) {
    items.push({
      id: 'pf-interest',
      tone: 'info',
      title:
        missing.length === 1
          ? `Add ${missing[0]} PF interest from your passbook`
          : `Add PF interest for ${missing.length} years from your passbook`,
      detail: `Not entered yet for ${missing.join(', ')}, so your PF balance reads lower than the passbook.`,
    });
  }

  const recent = [...payslips]
    .filter((slip) => slip.epfEmployee > 0)
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, RECENT_SLIPS);
  const without = recent.filter((slip) => slip.employerEpf + slip.employerEps === 0);
  if (without.length) {
    items.push({
      id: 'pf-employer',
      tone: 'info',
      title: `Employer PF share missing on ${without.length} recent ${without.length === 1 ? 'payslip' : 'payslips'}`,
      detail: `${[...without]
        .reverse()
        .map((slip) => monthLabel(slip.month, 'long'))
        .join(', ')}. Add it from the payslip or passbook (the payslip form can estimate it).`,
    });
  }

  if (entries.length) {
    const fy = financialYear(today);
    const now = pfBalance(entries).total;
    const grew = now - pfBalance(entries, `${fyStartYear(fy)}-03-31`).total;
    if (grew > 0) {
      items.push({
        id: 'pf-growth',
        tone: 'good',
        title: `PF grew ${money(grew)} this financial year`,
        detail: `${money(now)} now, your share and the employer's (${fy}; interest counts once credited).`,
      });
    }
  }
  return items;
}
