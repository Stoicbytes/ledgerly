import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { daysInMonth, monthLabel } from '@/lib/domain/expenses';
import {
  contributionFromPayslip,
  netPay,
  type Employer,
  type Payslip,
  type PfEntry,
} from '@/lib/domain/salary';
import { newId } from '@/lib/ids';
import { useSalaryStore } from './salaryStore';

const state = () => useSalaryStore.getState();
const set = (patch: Partial<ReturnType<typeof state>>) => useSalaryStore.setState(patch);

export type EmployerInput = Omit<Employer, 'id' | 'createdAt'>;
export type PayslipInput = Omit<Payslip, 'id' | 'createdAt' | 'transactionId'>;
export type PfEntryInput = Omit<PfEntry, 'id' | 'createdAt' | 'payslipId'>;
/** Where the net pay goes as an income entry; null to leave the ledger as it is. */
export type IncomeTarget = { accountId: string; categoryId: string | null } | null;

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((other) => other.id === item.id)
    ? list.map((other) => (other.id === item.id ? item : other))
    : [...list, item];

export function saveEmployer(input: EmployerInput, id?: string | null): Employer {
  const existing = id ? state().employers.find((item) => item.id === id) : undefined;
  const employer: Employer = {
    ...input,
    name: input.name.trim(),
    note: input.note.trim(),
    id: existing?.id ?? newId(),
    createdAt: existing?.createdAt ?? Date.now(),
  };
  set({ employers: upsert(state().employers, employer) });
  return employer;
}

/** Removes an employer, or returns false while payslips or PF entries still name it. */
export function deleteEmployer(id: string): boolean {
  const { employers, payslips, pfEntries } = state();
  if (payslips.some((slip) => slip.employerId === id)) return false;
  if (pfEntries.some((entry) => entry.employerId === id)) return false;
  set({ employers: employers.filter((item) => item.id !== id) });
  return true;
}

/** The income entry a payslip points at, while it still exists (deleting it unlinks it). */
const linkedIncome = (id: string | null) =>
  id && useExpenseStore.getState().transactions.some((item) => item.id === id) ? id : null;

/** Records (or updates) the income entry for a payslip's net pay; returns its id. */
function recordIncome(slip: Payslip, target: NonNullable<IncomeTarget>): string {
  const employer = state().employers.find((item) => item.id === slip.employerId);
  const date = slip.paidOn ?? `${slip.month}-${String(daysInMonth(slip.month)).padStart(2, '0')}`;
  const saved = useExpenseStore.getState().saveTransaction(
    {
      kind: 'income',
      date,
      amount: netPay(slip),
      accountId: target.accountId,
      toAccountId: null,
      fee: 0,
      categoryId: target.categoryId,
      note: `Salary · ${employer?.name ?? 'Employer'} · ${monthLabel(slip.month, 'short')}`,
      splits: [],
      personId: null,
      settles: [],
    },
    slip.transactionId,
  );
  return saved.id;
}

/**
 * Saves a payslip. Its PF amounts become (or update, or remove) its contribution in the
 * passbook. With an income target, the net pay is recorded as an income entry (or the one
 * recorded before is updated).
 */
export function savePayslip(input: PayslipInput, id: string | null, income: IncomeTarget): Payslip {
  const { payslips, pfEntries } = state();
  const existing = id ? payslips.find((item) => item.id === id) : undefined;
  let slip: Payslip = {
    ...input,
    note: input.note.trim(),
    earnings: input.earnings.map((line) => ({ ...line, label: line.label.trim() })),
    deductions: input.deductions.map((line) => ({ ...line, label: line.label.trim() })),
    id: existing?.id ?? newId(),
    createdAt: existing?.createdAt ?? Date.now(),
    transactionId: linkedIncome(existing?.transactionId ?? null),
  };
  if (income && netPay(slip) > 0) slip = { ...slip, transactionId: recordIncome(slip, income) };
  const previous = pfEntries.find((entry) => entry.payslipId === slip.id);
  const contribution = contributionFromPayslip(slip, previous, newId);
  const others = pfEntries.filter((entry) => entry.payslipId !== slip.id);
  set({
    payslips: upsert(payslips, slip),
    pfEntries: contribution ? [...others, contribution] : others,
  });
  return slip;
}

/** Deletes a payslip and its PF contribution (an income entry stays); returns Undo. */
export function deletePayslip(id: string): (() => void) | null {
  const { payslips, pfEntries } = state();
  const slip = payslips.find((item) => item.id === id);
  if (!slip) return null;
  const contribution = pfEntries.find((entry) => entry.payslipId === id);
  set({
    payslips: payslips.filter((item) => item.id !== id),
    pfEntries: pfEntries.filter((entry) => entry.payslipId !== id),
  });
  return () =>
    set({
      payslips: [...state().payslips, slip],
      pfEntries: contribution ? [...state().pfEntries, contribution] : state().pfEntries,
    });
}

export function savePfEntry(input: PfEntryInput, id?: string | null): PfEntry {
  const existing = id ? state().pfEntries.find((item) => item.id === id) : undefined;
  const entry: PfEntry = {
    ...input,
    note: input.note.trim(),
    id: existing?.id ?? newId(),
    payslipId: existing?.payslipId ?? null,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  set({ pfEntries: upsert(state().pfEntries, entry) });
  return entry;
}

/** Deletes a passbook entry; contributions from a payslip change with that payslip. */
export function deletePfEntry(id: string): (() => void) | null {
  const entry = state().pfEntries.find((item) => item.id === id);
  if (!entry || entry.payslipId) return null;
  set({ pfEntries: state().pfEntries.filter((item) => item.id !== id) });
  return () => set({ pfEntries: [...state().pfEntries, entry] });
}
