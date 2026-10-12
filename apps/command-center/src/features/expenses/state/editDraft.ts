import {
  amountToInput,
  inferSplitMode,
  splitTotal,
  type Transaction,
  type TransactionDraft,
} from '@/lib/domain/expenses';

/** Split mode and your own share for an expense opened for editing. */
function editSplitMode(transaction: Transaction) {
  const shares = (transaction.splits ?? []).map((split) => split.amount);
  const splitMode = inferSplitMode(transaction.amount, shares);
  const mine = transaction.amount - splitTotal(transaction);
  return { splitMode, myShareText: splitMode === 'custom' ? amountToInput(mine) || '0' : '' };
}

/** The form's draft for a saved transaction. */
export const editDraft = (transaction: Transaction): TransactionDraft => ({
  kind: transaction.kind,
  date: transaction.date,
  amountText: amountToInput(transaction.amount),
  categoryId: transaction.categoryId,
  accountId: transaction.accountId,
  toAccountId: transaction.toAccountId,
  feeText: transaction.fee ? amountToInput(transaction.fee) : '',
  note: transaction.note,
  splits: (transaction.splits ?? []).map((split) => ({
    personId: split.personId,
    amountText: amountToInput(split.amount),
  })),
  ...editSplitMode(transaction),
  personId: transaction.personId ?? null,
  settles: transaction.settles ?? [],
  photo: transaction.photo ?? null,
});
