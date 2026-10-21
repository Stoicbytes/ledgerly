import {
  monthBounds,
  transactionEffect,
  valuedOnInvestments,
  type Account,
  type InvestmentTracking,
  type Transaction,
} from '../expenses';
import type { PfEntry } from '../salary';
import { pfBalanceByMonth } from './salaryOverview';

export type NetWorthPoint = {
  month: string;
  total: number;
  accounts: number;
  investments: number;
  pf: number;
};

type NetWorthHistoryInput = {
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  tracking: InvestmentTracking;
  pfEntries: readonly PfEntry[];
  /** Month list, oldest first, ending with this month (the investment series' months). */
  months: readonly string[];
  /** Fund and share value at each month's end, from the investment pages' growth series. */
  funds: readonly number[];
  stocks: readonly number[];
};

/**
 * Net worth at the end of each month, counted the way the home screen counts it today:
 * account balances (cards and accounts valued on Investments left out), fund and share value,
 * and the PF balance. Accounts are worked out from their entries in one pass; their opening
 * balances have no date, so months before the first entry are left out rather than guessed
 * (without entries, from the first month with funds, shares or PF).
 * The last month counts every entry, like the figure shown today.
 */
export function netWorthHistory(input: NetWorthHistoryInput): NetWorthPoint[] {
  const { months } = input;
  if (!months.length) return [];
  const counted = input.accounts.filter(
    (account) => account.group !== 'card' && !valuedOnInvestments(account, input.tracking),
  );
  const ids = new Set(counted.map((account) => account.id));
  const ends = months.map((month, index) =>
    index === months.length - 1 ? '9999-12-31' : monthBounds(month).end,
  );
  const deltas = months.map(() => 0);
  let before = counted.reduce((sum, account) => sum + account.openingBalance, 0);
  let first: string | null = null;
  for (const transaction of input.transactions) {
    if (first === null || transaction.date < first) first = transaction.date;
    let effect = 0;
    if (transaction.accountId && ids.has(transaction.accountId))
      effect += transactionEffect(transaction, transaction.accountId);
    if (transaction.toAccountId && ids.has(transaction.toAccountId))
      effect += transactionEffect(transaction, transaction.toAccountId);
    if (!effect) continue;
    const index = ends.findIndex((end) => transaction.date <= end);
    if (transaction.date < `${months[0]}-01`) before += effect;
    else deltas[index] += effect;
  }
  const pf = pfBalanceByMonth(input.pfEntries, months);
  let running = before;
  const points = months.map((month, index) => {
    running += deltas[index];
    const investments = (input.funds[index] ?? 0) + (input.stocks[index] ?? 0);
    return {
      month,
      accounts: running,
      investments,
      pf: pf[index],
      total: running + investments + pf[index],
    };
  });
  const from =
    first === null
      ? points.findIndex((point) => point.investments || point.pf)
      : ends.findIndex((end) => end >= (first as string));
  return from < 0 ? [] : points.slice(from);
}
