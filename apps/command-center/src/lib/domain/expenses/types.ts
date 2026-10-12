import type { Photo } from './photos';

/**
 * Expense-manager domain model. Mirrors the Supabase tables (docs/architecture/DATABASE.md),
 * so the preview store and the cloud repositories share calculations and UI.
 * All money is integer paise; dates are local calendar dates (YYYY-MM-DD).
 */

export type CategoryKind = 'expense' | 'income';

export type Category = {
  id: string;
  kind: CategoryKind;
  /** null = top-level category; otherwise the parent's id (one level deep). */
  parentId: string | null;
  name: string;
  /** Icon key resolved by the UI layer (keeps the domain free of UI imports). */
  icon: string;
  /** Index into the theme's category tints. */
  tint: number;
  /** Monthly budget in paise (top-level expense categories only). */
  budget: number | null;
  order: number;
};

export type AccountGroup = 'cash' | 'bank' | 'card' | 'wallet' | 'investment' | 'loan';

export type Account = {
  id: string;
  name: string;
  group: AccountGroup;
  /** Signed paise: negative means money owed (cards, loans). */
  openingBalance: number;
  order: number;
};

export type TransactionKind = 'expense' | 'income' | 'transfer';

/** Someone you share expenses with (friends, family). */
export type Person = { id: string; name: string; order: number };

/** Part of an expense that a person owes you (paise, > 0). */
export type Split = { personId: string; amount: number };

export type Transaction = {
  id: string;
  kind: TransactionKind;
  date: string;
  /** Always > 0; direction comes from `kind`. */
  amount: number;
  /** Income: credited account. Expense: paying account. Transfer: source. */
  accountId: string;
  /** Transfer destination; null otherwise. */
  toAccountId: string | null;
  /** Transfer fee charged to the source account (counts as an expense). */
  fee: number;
  /** Leaf category (subcategory or top-level); null for transfers/uncategorised. */
  categoryId: string | null;
  note: string;
  createdAt: number;
  /**
   * Expenses only: shares other people owe you. Your own share (what Stats and
   * budgets count) is `amount` minus these; the account still pays the full amount.
   */
  splits?: Split[];
  /**
   * Income only: money a person paid back. It raises the account balance but is
   * not income, and it settles that person's splits (oldest first).
   */
  personId?: string | null;
  /**
   * Repayments only: the expenses this payment was for. Those shares are settled
   * first; anything left over settles the person's oldest shares.
   */
  settles?: string[];
  /** Receipt photo (signed in: stored privately; preview: in memory only). */
  photo?: Photo | null;
};

export type DateRange = { start: string; end: string };

export const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  cash: 'Cash',
  bank: 'Bank accounts',
  card: 'Cards',
  wallet: 'Wallets',
  investment: 'Savings & investments',
  loan: 'Loans',
};

/** One account's type, e.g. "Card · 12 entries" (group headings use the plural labels). */
export const ACCOUNT_TYPE_LABELS: Record<AccountGroup, string> = {
  cash: 'Cash',
  bank: 'Bank account',
  card: 'Card',
  wallet: 'Wallet',
  investment: 'Savings or investment',
  loan: 'Loan',
};

export const ACCOUNT_GROUP_ORDER: AccountGroup[] = [
  'cash',
  'bank',
  'card',
  'wallet',
  'investment',
  'loan',
];
