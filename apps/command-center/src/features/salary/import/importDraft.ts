import { amountToInput, monthOf, todayIso } from '@/lib/domain/expenses';
import type { Employer, Payslip } from '@/lib/domain/salary';
import {
  checkTotals,
  matchEmployer,
  type DetectedPayslip,
} from '@/lib/domain/salary/payslipImport';
import { newLine } from '../components/PayLinesEditor';
import type { PayslipDraft } from '../payslipDraft';

/** The payslip form filled from a file, ready for the owner to check and save. */
export function draftFromImport(slip: DetectedPayslip, employerId: string): PayslipDraft {
  const money = (paise: number | null) => amountToInput(paise ?? 0);
  return {
    employerId,
    month: slip.month ?? monthOf(todayIso()),
    paidOn: slip.paidOn,
    earnings: slip.earnings.map((line) => newLine(line.label, money(line.amount))),
    deductions: slip.deductions.map((line) => newLine(line.label, money(line.amount))),
    epfEmployee: money(slip.epfEmployee),
    vpf: money(slip.vpf),
    tds: money(slip.tds),
    employerEpf: money(slip.employerEpf),
    employerEps: money(slip.employerEps),
    note: '',
  };
}

/** Where an imported payslip stands against what is already in the app. */
export type ImportStatus = {
  employer: Employer | null;
  /** The payslip already saved for this employer and month, if any. */
  existing: Payslip | null;
  warnings: string[];
  /** Nothing to check: Save all may save it as it is. */
  clean: boolean;
};

export function importStatus(
  slip: DetectedPayslip,
  employers: readonly Employer[],
  payslips: readonly Payslip[],
): ImportStatus {
  const employer = slip.employerName ? matchEmployer(slip.employerName, employers) : null;
  const existing =
    (employer &&
      payslips.find((item) => item.employerId === employer.id && item.month === slip.month)) ||
    null;
  const warnings = checkTotals(slip);
  const clean = Boolean(employer) && !existing && !warnings.length && !slip.unsure.length;
  return { employer, existing, warnings, clean };
}
