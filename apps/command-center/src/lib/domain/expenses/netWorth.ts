import { sortAccounts } from './balances';
import type { Account } from './types';

/**
 * Which accounts net worth counts. Credit cards stay out (what they are owed is shown on its
 * own). An account in Savings & investments counts like any other (PPF, FD, RD, savings),
 * unless its name says it holds mutual funds or shares that you also track on the Mutual
 * funds or Stocks page: those are valued there at market prices, and the account only
 * records the money moved in, so counting both would count it twice. Funds and shares do not
 * name an account, so the name is the only link; renaming the account changes the rule.
 */
export type InvestmentTracking = { funds: boolean; stocks: boolean };

const FUND_WORDS = /mutual\s*funds?|\bmfs?\b|\bsips?\b|\belss\b|\bequit(y|ies)\b/i;
const SHARE_WORDS = /\bstocks?\b|\bshares?\b|\bdemat\b|\bequit(y|ies)\b|\bbrok(er|ing)/i;

/** True for a Savings & investments account whose holdings are valued on Investments. */
export function valuedOnInvestments(account: Account, tracking: InvestmentTracking): boolean {
  if (account.group !== 'investment') return false;
  return (
    (tracking.funds && FUND_WORDS.test(account.name)) ||
    (tracking.stocks && SHARE_WORDS.test(account.name))
  );
}

/**
 * The accounts shown with net worth (in display order), the ones left out because their
 * holdings are valued on Investments, and the accounts' part of net worth (cards excluded).
 */
export function netWorthAccounts(
  accounts: Account[],
  balances: Map<string, number>,
  tracking: InvestmentTracking,
) {
  const sorted = sortAccounts(accounts);
  const shown = sorted
    .filter((account) => !valuedOnInvestments(account, tracking))
    .map((account) => ({ account, balance: balances.get(account.id) ?? 0 }));
  return {
    shown,
    leftOut: sorted.filter((account) => valuedOnInvestments(account, tracking)),
    cash: shown
      .filter((item) => item.account.group !== 'card')
      .reduce((sum, item) => sum + item.balance, 0),
  };
}
