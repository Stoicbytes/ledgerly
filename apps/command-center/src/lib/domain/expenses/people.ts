import type { Person, Split, Transaction } from './types';

/** Sum of the shares other people owe on an expense. */
export const splitTotal = (transaction: Transaction): number =>
  (transaction.splits ?? []).reduce((sum, split) => sum + split.amount, 0);

/** A person paying you back: money in, but not income. */
export const isRepayment = (transaction: Transaction): boolean =>
  transaction.kind === 'income' && !!transaction.personId;

/**
 * What a transaction counts for in income/expense totals, Stats and budgets: your
 * own share of a split expense, nothing for a repayment, the amount otherwise.
 */
export function ownShare(transaction: Transaction): number {
  if (transaction.kind === 'expense')
    return Math.max(0, transaction.amount - splitTotal(transaction));
  if (isRepayment(transaction)) return 0;
  return transaction.amount;
}

/** How an expense is shared: equally with you, equally among the others only, or by hand. */
export type SplitMode = 'equal' | 'others' | 'custom';

/**
 * Equal shares of `amount` for `people` others, with you taking a share too when
 * `includeMe`. With you included, paise that do not divide evenly stay with you; when
 * the others pay all, they are spread over the first people so the shares add up to
 * exactly the amount.
 */
export function equalShares(amount: number, people: number, includeMe: boolean): number[] {
  if (people <= 0 || amount <= 0) return [];
  const each = Math.floor(amount / (people + (includeMe ? 1 : 0)));
  const extra = includeMe ? 0 : amount - each * people;
  return Array.from({ length: people }, (_, index) => each + (index < extra ? 1 : 0));
}

/** The mode an existing split matches (used when an expense is opened for editing). */
export function inferSplitMode(amount: number, shares: number[]): SplitMode {
  if (!shares.length) return 'equal';
  const same = (expected: number[]) =>
    expected.length === shares.length && expected.every((value, index) => value === shares[index]);
  if (same(equalShares(amount, shares.length, true))) return 'equal';
  if (same(equalShares(amount, shares.length, false))) return 'others';
  return 'custom';
}

/** Problem with a set of splits for an expense of `amount`, or null. */
export function splitsError(amount: number, splits: Split[]): string | null {
  const ids = new Set<string>();
  for (const split of splits) {
    if (!(split.amount > 0)) return 'Enter an amount for each person, or remove them.';
    if (ids.has(split.personId)) return 'Each person can appear once.';
    ids.add(split.personId);
  }
  const total = splits.reduce((sum, split) => sum + split.amount, 0);
  return total > amount ? 'Shares add up to more than the expense.' : null;
}

export type OpenSplit = {
  transaction: Transaction;
  amount: number;
  /** Covered by repayments so far (oldest splits are settled first). */
  paid: number;
  remaining: number;
};

export type PersonBalance = {
  person: Person;
  /** Total of their shares on your expenses. */
  lent: number;
  /** Total they paid back. */
  repaid: number;
  /** What they still owe you (negative: they paid more than they owe). */
  outstanding: number;
  splits: OpenSplit[];
  repayments: Transaction[];
};

const byDate = (a: Transaction, b: Transaction) =>
  a.date.localeCompare(b.date) || a.createdAt - b.createdAt;

/**
 * Each person's shares and repayments. A repayment made for particular expenses settles
 * those shares; general repayments (and any excess) settle the oldest shares first.
 */
export function personBalances(people: Person[], transactions: Transaction[]): PersonBalance[] {
  const sorted = [...transactions].sort(byDate);
  return people.map((person) => {
    const shares = sorted.flatMap((transaction) =>
      transaction.kind === 'expense'
        ? (transaction.splits ?? [])
            .filter((split) => split.personId === person.id)
            .map((split) => ({ transaction, amount: split.amount }))
        : [],
    );
    const repayments = sorted.filter(
      (transaction) => isRepayment(transaction) && transaction.personId === person.id,
    );
    const lent = shares.reduce((sum, share) => sum + share.amount, 0);
    const repaid = repayments.reduce((sum, transaction) => sum + transaction.amount, 0);
    const paid = shares.map(() => 0);
    let pool = 0;
    // Payments made for particular expenses settle those shares first (oldest first).
    for (const repayment of repayments) {
      let left = repayment.amount;
      const targets = new Set(repayment.settles ?? []);
      shares.forEach((share, index) => {
        if (!targets.has(share.transaction.id) || left <= 0) return;
        const take = Math.min(left, share.amount - paid[index]);
        paid[index] += take;
        left -= take;
      });
      pool += left;
    }
    // General payments, and anything left over, settle the oldest shares still open.
    shares.forEach((share, index) => {
      const take = Math.min(pool, share.amount - paid[index]);
      paid[index] += take;
      pool -= take;
    });
    const splits = shares.map((share, index) => ({
      ...share,
      paid: paid[index],
      remaining: share.amount - paid[index],
    }));
    return {
      person,
      lent,
      repaid,
      outstanding: lent - repaid,
      splits: splits.reverse(),
      repayments: repayments.reverse(),
    };
  });
}

/** Key for one person's share of one expense in `shareStatuses`. */
export const shareKey = (transactionId: string, personId: string): string =>
  `${transactionId}:${personId}`;

/** How much of each share has been paid back, keyed by `shareKey`. */
export function shareStatuses(
  people: Person[],
  transactions: Transaction[],
): Map<string, OpenSplit> {
  const statuses = new Map<string, OpenSplit>();
  for (const balance of personBalances(people, transactions)) {
    for (const split of balance.splits) {
      statuses.set(shareKey(split.transaction.id, balance.person.id), split);
    }
  }
  return statuses;
}

/** True when deleting the person would orphan shares or repayments. */
export const personInUse = (personId: string, transactions: Transaction[]): boolean =>
  transactions.some(
    (transaction) =>
      transaction.personId === personId ||
      (transaction.splits ?? []).some((split) => split.personId === personId),
  );
