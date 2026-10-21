import { addMonths, monthBounds, monthLabel } from '../expenses/dates';
import { financialYear } from '../investments/capitalGains';
import { fyStartYear, grossPay, netPay, type Employer, type Payslip } from '../salary';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { latestPayslip } from './salaryOverview';
import { daysBetween, monthName, pct, type Insight } from './types';

/** A payslip is "missing" once its month ended this many days ago without one. */
export const PAYSLIP_LATE_DAYS = 45;
/** Past this gap the payslips have likely stopped (a break, a move): no reminder. */
const PAYSLIP_GAP_LIMIT = 180;

/**
 * How the newest payslip compares with the one before (same employer) and with the same
 * month a year earlier: a rise of 5% or more is good news; a drop of 10% or more against the
 * month before is pointed out (a missing allowance, unpaid leave). Gross pay is compared, so
 * a change in tax or PF does not read as a pay change.
 */
export function salaryChangeInsight(payslips: readonly Payslip[]): Insight | null {
  const latest = latestPayslip(payslips);
  if (!latest) return null;
  const find = (back: number) =>
    payslips.find(
      (slip) =>
        slip.employerId === latest.employerId && slip.month === addMonths(latest.month, back),
    );
  const gross = grossPay(latest);
  const previous = find(-1);
  const yearAgo = find(-12);
  const change = (other: Payslip) => ((gross - grossPay(other)) / grossPay(other)) * 100;
  const yearPart =
    yearAgo && grossPay(yearAgo) > 0
      ? ` ${pct(Math.abs(change(yearAgo)))} ${change(yearAgo) >= 0 ? 'more' : 'less'} than ${monthLabel(yearAgo.month, 'long')}.`
      : '';
  if (previous && grossPay(previous) > 0) {
    const delta = change(previous);
    if (delta >= 5) {
      return {
        id: 'salary-change',
        tone: 'good',
        title: `Gross pay up ${pct(delta)} from ${monthName(previous.month)}`,
        detail: `${money(gross)} for ${monthLabel(latest.month, 'long')}, against ${money(grossPay(previous))}.${yearPart}`,
      };
    }
    if (delta <= -10) {
      const now = new Set(latest.earnings.map((line) => line.label.trim().toLowerCase()));
      const gone = previous.earnings.filter((line) => !now.has(line.label.trim().toLowerCase()));
      return {
        id: 'salary-change',
        tone: 'info',
        title: `${monthName(latest.month)} gross pay was ${pct(-delta)} lower than ${monthName(previous.month)}`,
        detail: `${money(gross)} against ${money(grossPay(previous))}. ${
          gone.length
            ? `No ${gone.map((line) => line.label).join(', ')} this time.`
            : 'Check for a missing allowance or unpaid leave.'
        }`,
      };
    }
  }
  if (yearAgo && grossPay(yearAgo) > 0 && change(yearAgo) >= 5) {
    return {
      id: 'salary-change',
      tone: 'good',
      title: `Gross pay is ${pct(change(yearAgo))} higher than a year ago`,
      detail: `${money(gross)} for ${monthLabel(latest.month, 'long')}, against ${money(grossPay(yearAgo))} for ${monthLabel(yearAgo.month, 'long')}.`,
    };
  }
  return null;
}

/**
 * The next payslip is overdue: the newest one's month ended more than 45 days ago. Quiet
 * when the employer has an end date by then, or when the gap is long enough to be a break.
 */
export function missingPayslipInsight(
  payslips: readonly Payslip[],
  employers: readonly Employer[],
  today: string,
): Insight | null {
  const latest = latestPayslip(payslips);
  if (!latest) return null;
  const days = daysBetween(monthBounds(latest.month).end, today);
  if (days <= PAYSLIP_LATE_DAYS || days > PAYSLIP_GAP_LIMIT) return null;
  const next = addMonths(latest.month, 1);
  const leftOn = employers.find((item) => item.id === latest.employerId)?.leftOn;
  if (leftOn && leftOn < monthBounds(next).end) return null;
  return {
    id: 'payslip-missing',
    tone: 'warn',
    title: `No payslip for ${monthName(next)} yet`,
    detail: `The last one is for ${monthLabel(latest.month, 'long')}. Import it on Salary & PF.`,
  };
}

/**
 * Tax deducted at source this financial year, and about how much by March if every month
 * left has as much as the newest payslip. Arithmetic only: no tax slabs, no advice.
 */
export function tdsInsight(payslips: readonly Payslip[], today: string): Insight | null {
  const fy = financialYear(today);
  const slips = payslips.filter((slip) => financialYear(`${slip.month}-01`) === fy);
  const tds = slips.reduce((sum, slip) => sum + slip.tds, 0);
  const latest = latestPayslip(slips);
  if (!latest || tds <= 0) return null;
  const monthly = slips
    .filter((slip) => slip.month === latest.month)
    .reduce((sum, slip) => sum + slip.tds, 0);
  const march = `${fyStartYear(fy) + 1}-03`;
  let left = 0;
  for (let month = addMonths(latest.month, 1); month <= march; month = addMonths(month, 1))
    left += 1;
  const so = `${money(tds)} deducted so far in ${fy}`;
  if (!left || !monthly) {
    return {
      id: 'tds',
      tone: 'info',
      title: `${money(tds)} tax (TDS) deducted in ${fy}`,
      detail: `${so}.`,
    };
  }
  return {
    id: 'tds',
    tone: 'info',
    title: `About ${money(tds + monthly * left)} tax (TDS) by March at this rate`,
    detail: `${so}; ${money(monthly)} on the ${monthName(latest.month)} payslip, ${left} ${left === 1 ? 'month' : 'months'} to go.`,
  };
}

/** The newest salary in one line (shown when there is no TDS line to say more). */
export function lastSalaryInsight(payslips: readonly Payslip[]): Insight | null {
  const latest = latestPayslip(payslips);
  if (!latest) return null;
  return {
    id: 'salary',
    tone: 'info',
    title: `Last salary ${money(netPay(latest))} for ${monthLabel(latest.month, 'short')}`,
    detail: `Gross ${money(grossPay(latest))}, tax deducted ${money(latest.tds)}.`,
  };
}
