import { amountToInput, type RecurringEntry, type TransactionDraft } from '@/lib/domain/expenses';
import type { Lookup } from '../hooks/useLedger';

/** "Rent", "Food › Tea" or "Main bank → Credit card": how a rule is named in lists. */
export function ruleTitle(rule: RecurringEntry, lookup: Lookup): string {
  if (rule.note.trim()) return rule.note.trim();
  if (rule.kind === 'transfer') {
    const from = lookup.account(rule.accountId)?.name ?? 'Account';
    const to = lookup.account(rule.toAccountId)?.name ?? 'account';
    return `${from} → ${to}`;
  }
  return lookup.path(rule.categoryId) ?? (rule.kind === 'income' ? 'Income' : 'Expense');
}

/** The entry sheet's fields for one due date of the rule (amount can still be changed). */
export function dueDraft(
  rule: RecurringEntry,
  date: string,
  lookup: Lookup,
): Partial<TransactionDraft> {
  return {
    kind: rule.kind,
    date,
    amountText: amountToInput(rule.amount),
    categoryId: lookup.category(rule.categoryId) ? rule.categoryId : null,
    accountId: lookup.account(rule.accountId) ? rule.accountId : null,
    toAccountId: rule.toAccountId && lookup.account(rule.toAccountId) ? rule.toAccountId : null,
    feeText: rule.fee ? amountToInput(rule.fee) : '',
    note: rule.note,
    fromRule: { id: rule.id, date },
  };
}
