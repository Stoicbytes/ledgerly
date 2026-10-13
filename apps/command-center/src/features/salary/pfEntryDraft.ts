import {
  amountToInput,
  isValidIsoDate,
  monthOf,
  parseLimitedAmount,
  todayIso,
} from '@/lib/domain/expenses';
import {
  estimateInterest,
  fyLabel,
  fyStartYear,
  type PfEntry,
  type PfKind,
} from '@/lib/domain/salary';
import { financialYear } from '@/lib/domain/investments';
import type { PfEntryInput } from './state/salaryActions';

/** The PF entry form: amounts stay text until saved. */
export type PfDraft = {
  kind: PfKind;
  date: string;
  month: string;
  fy: string;
  employerId: string | null;
  employee: string;
  vpf: string;
  employer: string;
  pension: string;
  rate: string;
  note: string;
};

export function pfDraftFrom(
  entry: PfEntry | null,
  kind: PfKind,
  employerId: string | null,
): PfDraft {
  const today = todayIso();
  const lastYear = fyLabel(fyStartYear(financialYear(today)) - 1);
  return {
    kind: entry?.kind ?? kind,
    date: entry?.date ?? today,
    month: entry ? monthOf(entry.date) : monthOf(today),
    fy: entry?.kind === 'interest' ? financialYear(entry.date) : lastYear,
    employerId: entry?.employerId ?? employerId,
    employee: amountToInput(entry?.employee ?? 0),
    vpf: amountToInput(entry?.vpf ?? 0),
    employer: amountToInput(entry?.employer ?? 0),
    pension: amountToInput(entry?.pension ?? 0),
    rate: entry?.rate != null ? String(entry.rate) : '',
    note: entry?.note ?? '',
  };
}

const money = (text: string) => (text.trim() ? parseLimitedAmount(text) : 0);

/** The interest for `fy` at `rate`, split into your share and the employer's. */
export function interestEstimate(entries: readonly PfEntry[], fy: string, rate: number) {
  const mine = entries.map((entry) => ({ ...entry, employer: 0 }));
  const theirs = entries.map((entry) => ({ ...entry, employee: 0, vpf: 0 }));
  return {
    employee: estimateInterest(mine, fy, rate),
    employer: estimateInterest(theirs, fy, rate),
  };
}

export const parseRate = (text: string) => {
  const rate = Number(text.replace('%', '').trim());
  return text.trim() && Number.isFinite(rate) && rate > 0 && rate <= 20 ? rate : null;
};

/** The entry to save, or the message to show. */
export function readPfDraft(draft: PfDraft): { input: PfEntryInput } | { error: string } {
  const amounts = {
    employee: money(draft.employee),
    vpf: draft.kind === 'contribution' ? money(draft.vpf) : 0,
    employer: money(draft.employer),
    pension: draft.kind === 'contribution' || draft.kind === 'opening' ? money(draft.pension) : 0,
  };
  if (Object.values(amounts).some((value) => value === null))
    return { error: 'Check the amounts (like 12,500).' };
  const values = amounts as Record<keyof typeof amounts, number>;
  if (!Object.values(values).some((value) => value > 0))
    return { error: 'Enter at least one amount.' };
  const rate = draft.kind === 'interest' ? parseRate(draft.rate) : null;
  if (draft.kind === 'interest' && rate === null)
    return { error: 'Enter the rate EPFO declared, like 8.25.' };
  if (draft.kind === 'contribution' && !draft.employerId) return { error: 'Choose the employer.' };
  const date =
    draft.kind === 'contribution'
      ? `${draft.month}-01`
      : draft.kind === 'interest'
        ? `${fyStartYear(draft.fy) + 1}-03-31`
        : draft.date;
  if (!isValidIsoDate(date)) return { error: 'Pick a date.' };
  return {
    input: {
      kind: draft.kind,
      date,
      employerId: draft.kind === 'contribution' ? draft.employerId : null,
      ...values,
      rate,
      note: draft.note,
    },
  };
}
