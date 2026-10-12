import { useMemo } from 'react';
import {
  ACCOUNT_GROUP_ORDER,
  balanceHistory,
  balanceSummary,
  monthBounds,
  monthOf,
  periodTotals,
  sortAccounts,
  todayIso,
  touchesAccount,
} from '@/lib/domain/expenses';
import { useLedger } from '../hooks/useLedger';

/** How many recent entries the account detail lists. */
const RECENT = 40;

/** Balances by group, the assets / liabilities summary, and the selected account's detail. */
export function useAccountsView(selectedId: string | null) {
  const { accounts, transactions } = useLedger();
  return useMemo(() => {
    const summary = balanceSummary(accounts, transactions);
    const ordered = sortAccounts(accounts);
    const balanceOf = (id: string, opening: number) => summary.balances.get(id) ?? opening;
    const groups = ACCOUNT_GROUP_ORDER.map((group) => {
      const items = ordered
        .filter((account) => account.group === group)
        .map((account) => ({ account, balance: balanceOf(account.id, account.openingBalance) }));
      return { group, items, total: items.reduce((sum, item) => sum + item.balance, 0) };
    }).filter((group) => group.items.length > 0);
    const account = ordered.find((item) => item.id === selectedId) ?? ordered[0] ?? null;
    const month = monthOf(todayIso());
    const entries = account
      ? transactions
          .filter((transaction) => touchesAccount(transaction, account.id))
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      : [];
    return {
      summary,
      groups,
      detail: account
        ? {
            account,
            balance: balanceOf(account.id, account.openingBalance),
            thisMonth: periodTotals(transactions, monthBounds(month), account.id),
            history: balanceHistory(account, transactions, month, 6),
            recent: entries.slice(0, RECENT),
            entryCount: entries.length,
          }
        : null,
    };
  }, [accounts, transactions, selectedId]);
}

export type AccountsView = ReturnType<typeof useAccountsView>;
export type AccountDetailData = NonNullable<AccountsView['detail']>;
