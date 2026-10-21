import { addMonths, monthBounds, monthOf } from '../expenses/dates';
import { financialYear } from '../investments/capitalGains';
import {
  fyStartYear,
  grossPay,
  netPay,
  pfBalance,
  salaryYears,
  type Payslip,
  type PfBalance,
  type PfEntry,
  type SalaryYear,
} from '../salary';

export type PayMonth = { month: string; gross: number; net: number; tds: number; slips: number };

/** The newest payslip (latest pay month, then the last one added). */
export const latestPayslip = (payslips: readonly Payslip[]): Payslip | undefined =>
  [...payslips].sort((a, b) => b.month.localeCompare(a.month) || b.createdAt - a.createdAt)[0];

/**
 * Pay per month, every employer together, for the `count` months ending with the newest
 * payslip, oldest first. Months before the first payslip in that window are left out; a
 * month without a payslip inside it stays, at zero.
 */
export function payByMonth(payslips: readonly Payslip[], count = 12): PayMonth[] {
  const end = latestPayslip(payslips)?.month;
  if (!end) return [];
  const list = Array.from({ length: count }, (_, index) => ({
    month: addMonths(end, index - count + 1),
    gross: 0,
    net: 0,
    tds: 0,
    slips: 0,
  }));
  const byMonth = new Map(list.map((item) => [item.month, item]));
  for (const slip of payslips) {
    const item = byMonth.get(slip.month);
    if (!item) continue;
    item.gross += grossPay(slip);
    item.net += netPay(slip);
    item.tds += slip.tds;
    item.slips += 1;
  }
  return list.slice(list.findIndex((item) => item.slips > 0));
}

/**
 * The PF balance (your share and the employer's, as pfBalance counts it) at the end of each
 * of `months` (oldest first), in one pass. The last month also counts entries dated after
 * it, so it matches the balance shown everywhere else.
 */
export function pfBalanceByMonth(entries: readonly PfEntry[], months: readonly string[]): number[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const result: number[] = [];
  let balance = 0;
  let next = 0;
  months.forEach((month, index) => {
    const end = index === months.length - 1 ? '9999-12-31' : monthBounds(month).end;
    for (; next < sorted.length && sorted[next].date <= end; next += 1) {
      const entry = sorted[next];
      const amount = entry.employee + entry.vpf + entry.employer;
      balance += entry.kind === 'withdrawal' ? -amount : amount;
    }
    result.push(balance);
  });
  return result;
}

/** The PF balance at each month end over the `count` months to `today`, from the first entry. */
export function pfHistory(entries: readonly PfEntry[], today: string, count = 24) {
  if (!entries.length) return [];
  const end = monthOf(today);
  const months = Array.from({ length: count }, (_, index) => addMonths(end, index - count + 1));
  const first = entries.reduce((min, entry) => (entry.date < min ? entry.date : min), '9999');
  const shown = months.filter((month) => monthBounds(month).end >= first);
  const balances = pfBalanceByMonth(entries, shown);
  return shown.map((month, index) => ({ month, balance: balances[index] }));
}

export type SalaryOverview = {
  latest: { slip: Payslip; gross: number; net: number } | null;
  /** This financial year's totals, or the newest year with payslips when it has none yet. */
  year: SalaryYear | null;
  /** TDS as a share of gross pay in `year` (0–1), null without pay. */
  tdsRate: number | null;
  pf: PfBalance;
  /** How much the PF balance grew since 1 April of this financial year. */
  pfGrowth: number;
  pay: PayMonth[];
  pfHistory: { month: string; balance: number }[];
};

/** Everything the home screen's Salary & PF card shows. */
export function salaryOverview(
  payslips: readonly Payslip[],
  pfEntries: readonly PfEntry[],
  today: string,
): SalaryOverview {
  const slip = latestPayslip(payslips);
  const years = salaryYears(payslips);
  const year = years.find((item) => item.fy === financialYear(today)) ?? years[0] ?? null;
  const pf = pfBalance(pfEntries);
  const fyStart = `${fyStartYear(financialYear(today))}-03-31`;
  return {
    latest: slip ? { slip, gross: grossPay(slip), net: netPay(slip) } : null,
    year,
    tdsRate: year && year.gross > 0 ? year.tds / year.gross : null,
    pf,
    pfGrowth: pf.total - pfBalance(pfEntries, fyStart).total,
    pay: payByMonth(payslips),
    pfHistory: pfHistory(pfEntries, today),
  };
}
