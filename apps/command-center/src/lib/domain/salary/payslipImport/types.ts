import type { PayLine } from '../types';

export type { TextLine, TextWord } from '@/lib/files/pdfText/lines';

export type Confidence = 'high' | 'low';

/** Fields the review highlights for checking. */
export type ImportField = 'month' | 'employer' | 'earnings' | 'deductions' | 'pf' | 'tds';

/**
 * What a payslip file says, as read on this device. Amounts are paise. Employer shares are
 * null when the payslip does not print them (never guessed here). Identity numbers (UAN,
 * PAN, account numbers…) are never part of it.
 */
export type DetectedPayslip = {
  month: string | null;
  paidOn: string | null;
  employerName: string | null;
  earnings: PayLine[];
  deductions: PayLine[];
  epfEmployee: number;
  vpf: number;
  tds: number;
  employerEpf: number | null;
  employerEps: number | null;
  /** Totals as printed, to check the lines against. */
  printed: { gross: number | null; deductions: number | null; net: number | null };
  /** Fields read with less certainty. */
  unsure: ImportField[];
};
