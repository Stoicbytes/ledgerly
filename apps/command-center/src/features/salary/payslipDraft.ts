import {
  addMonths,
  amountToInput,
  monthOf,
  parseLimitedAmount,
  todayIso,
} from '@/lib/domain/expenses';
import { payslipProblem, type PayLine, type Payslip } from '@/lib/domain/salary';
import { newLine, type LineDraft } from './components/PayLinesEditor';
import type { PayslipInput } from './state/salaryActions';

/** The payslip form while it is being filled in: amounts stay text until saved. */
export type PayslipDraft = {
  employerId: string;
  month: string;
  paidOn: string | null;
  earnings: LineDraft[];
  deductions: LineDraft[];
  epfEmployee: string;
  vpf: string;
  tds: string;
  employerEpf: string;
  employerEps: string;
  note: string;
};

const PF_FIELDS = ['epfEmployee', 'vpf', 'tds', 'employerEpf', 'employerEps'] as const;
export type PfField = (typeof PF_FIELDS)[number];

const toLines = (lines: PayLine[]) =>
  lines.map((line) => newLine(line.label, amountToInput(line.amount)));

/**
 * A new payslip starts from `template` (the latest one), a month later, so a month's slip
 * usually needs only the changes; an existing one is edited as it is.
 */
export function draftFrom(
  slip: Payslip | null,
  template: Payslip | null,
  employerId: string,
): PayslipDraft {
  const base = slip ?? template;
  return {
    employerId: slip?.employerId ?? template?.employerId ?? employerId,
    month: slip?.month ?? (template ? addMonths(template.month, 1) : monthOf(todayIso())),
    paidOn: slip?.paidOn ?? null,
    earnings: base ? toLines(base.earnings) : [newLine('Basic'), newLine('HRA')],
    deductions: base ? toLines(base.deductions) : [newLine('Professional tax')],
    epfEmployee: amountToInput(base?.epfEmployee ?? 0),
    vpf: amountToInput(base?.vpf ?? 0),
    tds: amountToInput(base?.tds ?? 0),
    employerEpf: amountToInput(base?.employerEpf ?? 0),
    employerEps: amountToInput(base?.employerEps ?? 0),
    note: slip?.note ?? '',
  };
}

/** Text → paise: empty is 0, anything unreadable is null. */
const money = (text: string) => (text.trim() ? parseLimitedAmount(text) : 0);

function parseLines(lines: LineDraft[]): PayLine[] | null {
  const parsed: PayLine[] = [];
  for (const line of lines) {
    if (!line.label.trim() && !line.amount.trim()) continue;
    const amount = money(line.amount);
    if (amount === null) return null;
    parsed.push({ label: line.label.trim(), amount });
  }
  return parsed;
}

export type DraftErrors = Partial<Record<'earnings' | 'deductions' | 'form' | PfField, string>>;

/** The payslip to save, or what is wrong with the form. */
export function readDraft(
  draft: PayslipDraft,
  others: readonly Payslip[],
  id: string | null,
): { input: PayslipInput; errors?: undefined } | { input?: undefined; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const earnings = parseLines(draft.earnings);
  const deductions = parseLines(draft.deductions);
  if (!earnings) errors.earnings = 'Check the amounts (like 45,000).';
  if (!deductions) errors.deductions = 'Check the amounts (like 200).';
  const pf: Partial<Record<PfField, number>> = {};
  for (const field of PF_FIELDS) {
    const value = money(draft[field]);
    if (value === null) errors[field] = 'Enter an amount, like 1,800.';
    else pf[field] = value;
  }
  if (Object.keys(errors).length || !earnings || !deductions) return { errors };
  const input: PayslipInput = {
    employerId: draft.employerId,
    month: draft.month,
    paidOn: draft.paidOn,
    earnings,
    deductions,
    epfEmployee: pf.epfEmployee ?? 0,
    vpf: pf.vpf ?? 0,
    tds: pf.tds ?? 0,
    employerEpf: pf.employerEpf ?? 0,
    employerEps: pf.employerEps ?? 0,
    note: draft.note,
  };
  const problem = payslipProblem(
    { ...input, id: id ?? '', transactionId: null, createdAt: 0 },
    others,
  );
  return problem ? { errors: { form: problem } } : { input };
}
