import { amountToInput, parseAmount, todayIso } from '@/lib/domain/expenses';
import { suggestStampDuty, type FundTxn, type FundTxnDraft } from '@/lib/domain/investments';

/** The form for an existing transaction, or a new one (optionally pre-filled for a SIP). */
export function initialDraft(
  existing: FundTxn | undefined,
  preset?: Partial<FundTxnDraft>,
): FundTxnDraft {
  const draft: FundTxnDraft = {
    kind: existing?.kind ?? 'buy',
    date: existing?.date ?? todayIso(),
    amountText: existing ? amountToInput(existing.amount) : '',
    stampDutyText: existing?.stampDuty ? amountToInput(existing.stampDuty) : '',
    unitsText: existing?.units ? String(existing.units) : '',
    navText: existing?.nav ? String(existing.nav) : '',
    note: existing?.note ?? '',
    sipId: existing?.sipId ?? null,
    ...preset,
  };
  const amount = parseAmount(draft.amountText);
  if (!existing && draft.kind === 'buy' && amount && !draft.stampDutyText) {
    draft.stampDutyText = amountToInput(suggestStampDuty(amount));
  }
  return draft;
}
