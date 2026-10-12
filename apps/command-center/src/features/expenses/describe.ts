import { ArrowLeftRight, HandCoins, type LucideIcon } from '@/components/icons';
import { ownShare, transactionEffect, type Transaction } from '@/lib/domain/expenses';
import { iconFor } from './categoryIcons';
import { formatEntry } from './format';
import type { Lookup } from './hooks/useLedger';

export type EntryTone = 'income' | 'expense' | 'transfer';

export type EntryDescription = {
  icon: LucideIcon;
  /** Category tint index, or 'transfer' for the transfer colours. */
  tint: number | 'transfer';
  title: string;
  caption: string;
  /** Signed amount to display: income +, expense −, transfers signed only for a filtered account. */
  amount: number;
  /** False for transfers seen from no particular account (shown unsigned). */
  signed: boolean;
  tone: EntryTone;
};

const MISSING_ACCOUNT = 'Deleted account';

/**
 * How a transaction reads in a list: the note is the title when there is one
 * (as in Money Manager), otherwise the category. Transfers show "From → To".
 */
export function describeTransaction(
  transaction: Transaction,
  lookup: Lookup,
  accountId?: string | null,
): EntryDescription {
  const account = lookup.account(transaction.accountId)?.name ?? MISSING_ACCOUNT;
  if (transaction.kind === 'transfer') {
    const to = lookup.account(transaction.toAccountId)?.name ?? MISSING_ACCOUNT;
    const fee = transaction.fee ? ` · fee ${formatEntry(transaction.fee)}` : '';
    const filtered =
      !!accountId && (accountId === transaction.accountId || accountId === transaction.toAccountId);
    return {
      icon: ArrowLeftRight,
      tint: 'transfer',
      title: transaction.note || 'Transfer',
      caption: `${account} → ${to}${fee}`,
      amount:
        filtered && accountId ? transactionEffect(transaction, accountId) : transaction.amount,
      signed: filtered,
      tone: 'transfer',
    };
  }
  if (transaction.kind === 'income' && transaction.personId) {
    const name = lookup.person(transaction.personId)?.name ?? 'Someone';
    return {
      icon: HandCoins,
      tint: 'transfer',
      title: `${name} paid you back`,
      caption: `Repayment · ${account}`,
      amount: transaction.amount,
      signed: true,
      tone: 'income',
    };
  }
  const { parent, sub } = lookup.resolve(transaction.categoryId);
  const leaf = sub ?? parent;
  const path = lookup.path(transaction.categoryId) ?? 'Uncategorized';
  const base = transaction.note
    ? `${path} · ${account}`
    : sub && parent
      ? `${parent.name} · ${account}`
      : account;
  const { open, paid } = splitNames(transaction, lookup);
  const people = [
    open.length ? `split with ${open.join(', ')}` : '',
    paid.length ? `${paid.join(', ')} paid` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  // A split expense still shows what left the account; the caption says your share.
  const caption = people
    ? `${base} · ${people} · your share ${formatEntry(ownShare(transaction))}`
    : base;
  return {
    icon: iconFor(parent?.icon ?? 'other'),
    tint: parent?.tint ?? 0,
    title: transaction.note || leaf?.name || 'Uncategorized',
    caption,
    amount: transaction.kind === 'income' ? transaction.amount : -transaction.amount,
    signed: true,
    tone: transaction.kind,
  };
}

/** Names of the people on a split expense: those who still owe, and those who paid back. */
function splitNames(transaction: Transaction, lookup: Lookup): { open: string[]; paid: string[] } {
  const open: string[] = [];
  const paid: string[] = [];
  for (const split of transaction.splits ?? []) {
    const name = lookup.person(split.personId)?.name ?? 'someone';
    const status = lookup.share(transaction.id, split.personId);
    (status && status.remaining === 0 ? paid : open).push(name);
  }
  return { open, paid };
}
