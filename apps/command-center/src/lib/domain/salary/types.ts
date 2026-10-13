/**
 * Salary and PF / EPF (migration 0016). Money is integer paise. Nothing here is tied to
 * one company: payslips and PF entries name their employer, and the PF account follows
 * you from job to job (one UAN). No UAN, member ID, PAN or other identity number is kept.
 */

export type Employer = {
  id: string;
  name: string;
  /** When you joined and left (ISO dates); null when not entered or still there. */
  joinedOn: string | null;
  leftOn: string | null;
  note: string;
  createdAt: number;
};

/** One line of a payslip: "Basic", "HRA", "Professional tax"… */
export type PayLine = { label: string; amount: number };

export type Payslip = {
  id: string;
  employerId: string;
  /** The pay month, "2026-04". */
  month: string;
  /** The day the salary reached your account (ISO date), if entered. */
  paidOn: string | null;
  earnings: PayLine[];
  /** Deductions other than employee EPF, VPF and TDS (professional tax, insurance…). */
  deductions: PayLine[];
  epfEmployee: number;
  vpf: number;
  tds: number;
  /** The employer's shares: they go to PF and pension, not into your pay. */
  employerEpf: number;
  employerEps: number;
  /** The income entry recorded for the net pay, if any. */
  transactionId: string | null;
  note: string;
  createdAt: number;
};

export type PfKind = 'contribution' | 'interest' | 'withdrawal' | 'opening';

export type PfEntry = {
  id: string;
  kind: PfKind;
  /**
   * contribution: the wage month's first day ("2026-04-01"); interest: the 31 March of the
   * financial year it is for (as the passbook shows); withdrawal and opening: their date.
   */
  date: string;
  employerId: string | null;
  /** The payslip this contribution came from; it follows that payslip. */
  payslipId: string | null;
  /** Your EPF share (for a withdrawal: what was taken from it). */
  employee: number;
  /** Voluntary PF on top of the employee share (contributions only). */
  vpf: number;
  /** The employer's EPF share. */
  employer: number;
  /** The employer's pension (EPS) share: not part of the PF balance. */
  pension: number;
  /** The yearly rate EPFO declared, entered with the interest (percent). */
  rate: number | null;
  note: string;
  createdAt: number;
};

export const PF_KIND_LABELS: Record<PfKind, string> = {
  contribution: 'Contribution',
  interest: 'Interest',
  withdrawal: 'Withdrawal',
  opening: 'Opening balance',
};
