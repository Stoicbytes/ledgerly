import { formatMoney } from '@/lib/formatting/currency';
import type { DetectedPayslip } from './types';

/** Rounding on payslips: lines and totals may differ by up to ₹1. */
const TOLERANCE = 100;

const sum = (lines: { amount: number }[]) => lines.reduce((total, line) => total + line.amount, 0);

export const detectedGross = (slip: DetectedPayslip) => sum(slip.earnings);
export const detectedDeductions = (slip: DetectedPayslip) =>
  sum(slip.deductions) + slip.epfEmployee + slip.vpf + slip.tds;
export const detectedNet = (slip: DetectedPayslip) =>
  detectedGross(slip) - detectedDeductions(slip);

/**
 * Checks the lines read against the totals the payslip prints: earnings add up to gross,
 * deductions to total deductions, and gross − deductions is the net pay (±₹1). Each problem
 * is a short sentence for the review; none means everything agrees.
 */
export function checkTotals(slip: DetectedPayslip): string[] {
  const warnings: string[] = [];
  if (!slip.month) warnings.push('The pay month was not found.');
  if (!slip.employerName) warnings.push('The employer’s name was not found.');
  if (!slip.earnings.length) {
    warnings.push('No earnings were found.');
    return warnings;
  }
  const { gross, deductions, net } = slip.printed;
  if (gross === null && net === null) warnings.push('No totals are printed to check against.');
  if (gross !== null && Math.abs(detectedGross(slip) - gross) > TOLERANCE) {
    warnings.push(
      `Earnings add up to ${formatMoney(detectedGross(slip))}, but the payslip says gross ${formatMoney(gross)}.`,
    );
  }
  if (deductions !== null && Math.abs(detectedDeductions(slip) - deductions) > TOLERANCE) {
    warnings.push(
      `Deductions add up to ${formatMoney(detectedDeductions(slip))}, but the payslip says ${formatMoney(deductions)}.`,
    );
  }
  if (net !== null && Math.abs(detectedNet(slip) - net) > TOLERANCE) {
    warnings.push(
      `Net pay works out to ${formatMoney(detectedNet(slip))}, but the payslip says ${formatMoney(net)}.`,
    );
  }
  return warnings;
}
