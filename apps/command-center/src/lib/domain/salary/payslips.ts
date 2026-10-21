import { financialYear } from '../investments/capitalGains';
import type { PayLine, Payslip, PfEntry } from './types';

const sum = (lines: readonly PayLine[]) => lines.reduce((total, line) => total + line.amount, 0);

export const grossPay = (slip: Payslip) => sum(slip.earnings);

/** Everything taken from pay: other deductions, employee EPF, VPF and TDS. */
export const totalDeductions = (slip: Payslip) =>
  sum(slip.deductions) + slip.epfEmployee + slip.vpf + slip.tds;

export const netPay = (slip: Payslip) => grossPay(slip) - totalDeductions(slip);

/** "FY 2026-27" for the financial year a pay month falls in. */
export const payslipYear = (month: string) => financialYear(`${month}-01`);

/** Why a payslip cannot be saved, or null when it can. */
export function payslipProblem(slip: Payslip, others: readonly Payslip[]): string | null {
  if (!slip.employerId) return 'Choose the employer.';
  if (!/^\d{4}-\d{2}$/.test(slip.month)) return 'Choose the pay month.';
  const lines = [...slip.earnings, ...slip.deductions];
  if (lines.some((line) => !line.label.trim())) return 'Every line needs a name.';
  if (lines.length > 30 || slip.earnings.length > 15) return 'Too many lines.';
  if (!slip.earnings.length) return 'Add at least one earning, such as Basic.';
  if (netPay(slip) < 0) return 'Deductions are more than the earnings.';
  const clash = others.some(
    (other) =>
      other.id !== slip.id && other.employerId === slip.employerId && other.month === slip.month,
  );
  if (clash) return 'There is already a payslip for this employer and month.';
  return null;
}

/**
 * The PF contribution a payslip makes (null when it has no PF amounts). `existing` is the
 * contribution it made before; `newId` names a new one.
 */
export function contributionFromPayslip(
  slip: Payslip,
  existing: PfEntry | undefined,
  newId: () => string,
): PfEntry | null {
  const amounts = {
    employee: slip.epfEmployee,
    vpf: slip.vpf,
    employer: slip.employerEpf,
    pension: slip.employerEps,
  };
  if (!Object.values(amounts).some((value) => value > 0)) return null;
  return {
    id: existing?.id ?? newId(),
    kind: 'contribution',
    date: `${slip.month}-01`,
    employerId: slip.employerId,
    payslipId: slip.id,
    ...amounts,
    rate: null,
    note: existing?.note ?? '',
    createdAt: existing?.createdAt ?? slip.createdAt,
  };
}

/**
 * The statutory employer share, for payslips that do not print it: the employer pays 12% of
 * the PF wage (worked out from your EPF, which is 12% of it); the pension (EPS) part is 8.33%
 * of the wage, at most ₹1,250 a month, and the rest goes to EPF. An estimate only: some
 * employers pay on a capped wage, so the EPFO passbook has the real figures.
 */
export function estimateEmployerShare(epfEmployee: number): {
  employerEpf: number;
  employerEps: number;
} {
  if (epfEmployee <= 0) return { employerEpf: 0, employerEps: 0 };
  const wage = Math.round((epfEmployee * 100) / 12);
  const eps = Math.min(Math.round((wage * 833) / 10_000 / 100) * 100, 1_250_00);
  return { employerEpf: epfEmployee - eps, employerEps: eps };
}

export type SalaryTotals = {
  months: number;
  gross: number;
  deductions: number;
  tds: number;
  /** Employee EPF and VPF. */
  pf: number;
  net: number;
  /** The employer's EPF and pension shares (not part of pay). */
  employerPf: number;
};

export type SalaryYear = SalaryTotals & {
  fy: string;
  byEmployer: (SalaryTotals & { employerId: string })[];
};

const emptyTotals = (): SalaryTotals => ({
  months: 0,
  gross: 0,
  deductions: 0,
  tds: 0,
  pf: 0,
  net: 0,
  employerPf: 0,
});

function add(totals: SalaryTotals, slip: Payslip) {
  totals.months += 1;
  totals.gross += grossPay(slip);
  totals.deductions += totalDeductions(slip);
  totals.tds += slip.tds;
  totals.pf += slip.epfEmployee + slip.vpf;
  totals.net += netPay(slip);
  totals.employerPf += slip.employerEpf + slip.employerEps;
}

/** Totals per financial year, newest first, with each employer's part. */
export function salaryYears(payslips: readonly Payslip[]): SalaryYear[] {
  const years = new Map<string, SalaryYear>();
  for (const slip of payslips) {
    const fy = payslipYear(slip.month);
    const year = years.get(fy) ?? { fy, ...emptyTotals(), byEmployer: [] };
    add(year, slip);
    let part = year.byEmployer.find((item) => item.employerId === slip.employerId);
    if (!part) {
      part = { employerId: slip.employerId, ...emptyTotals() };
      year.byEmployer.push(part);
    }
    add(part, slip);
    years.set(fy, year);
  }
  return [...years.values()].sort((a, b) => b.fy.localeCompare(a.fy));
}

/** Labels used on earlier payslips, most used first, to suggest while typing. */
export function lineSuggestions(
  payslips: readonly Payslip[],
  side: 'earnings' | 'deductions',
): string[] {
  const counts = new Map<string, number>();
  for (const slip of payslips) {
    for (const line of slip[side]) {
      const label = line.label.trim();
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
}
