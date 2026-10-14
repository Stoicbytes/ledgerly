import { withoutImported } from '@/lib/domain/expenses';
import { RESTORE_KINDS, itemsOf, type RestoreKind } from './kinds';
import type { LedgerData } from './types';

export type AddedIds = Partial<Record<RestoreKind, string[]>>;

/** The ids of everything a plan adds, per kind (what an undo may remove). */
export function addedIds(add: LedgerData): AddedIds {
  const out: AddedIds = {};
  for (const kind of RESTORE_KINDS) {
    const items = itemsOf(add, kind);
    if (items?.length) out[kind] = items.map((item) => item.id);
  }
  return out;
}

/**
 * Takes a restore back: removes exactly the records it added that are still here.
 * Something added since that uses a restored record keeps it (an account, category,
 * person, goal, fund, SIP, share, employer or payslip in use stays). Records changed
 * or deleted since are left as they are.
 */
export function withoutRestored(current: LedgerData, added: AddedIds): LedgerData {
  const gone = (kind: RestoreKind) => new Set(added[kind] ?? []);
  const drop = <T extends { id: string }>(
    items: T[],
    ids: Set<string>,
    used = new Set<string | null>(),
  ) => items.filter((item) => !ids.has(item.id) || used.has(item.id));
  const { portfolio } = current;

  const recurring = current.recurring && drop(current.recurring, gone('recurring'));
  const ledgerItems = (kind: 'accounts' | 'categories' | 'transactions') => {
    const ids = gone(kind);
    return (current[kind] as { id: string }[]).filter((item) => ids.has(item.id));
  };
  const ledger = withoutImported(
    current,
    {
      accounts: ledgerItems('accounts') as LedgerData['accounts'],
      categories: ledgerItems('categories') as LedgerData['categories'],
      transactions: ledgerItems('transactions') as LedgerData['transactions'],
    },
    recurring ?? [],
  );
  const kept = new Set(ledger.transactions.map((item) => item.id));
  const people = drop(
    current.people,
    gone('people'),
    new Set(
      ledger.transactions.flatMap((t) => [
        t.personId ?? null,
        ...(t.splits ?? []).map((s) => s.personId),
      ]),
    ),
  );

  const fundTxns = drop(portfolio.fundTxns, gone('fundTxns'));
  const trades = drop(portfolio.trades, gone('trades'));
  const sips = drop(portfolio.sips, gone('sips'), new Set(fundTxns.map((t) => t.sipId)));
  const funds = drop(
    portfolio.funds,
    gone('funds'),
    new Set([...sips.map((s) => s.fundId), ...fundTxns.map((t) => t.fundId)]),
  );
  const stocks = drop(portfolio.stocks, gone('stocks'), new Set(trades.map((t) => t.stockId)));
  const goals =
    current.goals &&
    drop(current.goals, gone('goals'), new Set(funds.map((f) => f.goalId ?? null)));

  const pfEntries = current.pfEntries && drop(current.pfEntries, gone('pfEntries'));
  const payslips =
    current.payslips &&
    drop(current.payslips, gone('payslips'), new Set((pfEntries ?? []).map((f) => f.payslipId)))
      // A removed entry is unlinked from its payslip, as the database does.
      .map((p) =>
        p.transactionId && !kept.has(p.transactionId) ? { ...p, transactionId: null } : p,
      );
  const employers =
    current.employers &&
    drop(
      current.employers,
      gone('employers'),
      new Set([
        ...(payslips ?? []).map((p) => p.employerId),
        ...(pfEntries ?? []).map((f) => f.employerId),
      ]),
    );

  return {
    ...ledger,
    people,
    notes: drop(current.notes, gone('notes')),
    portfolio: { funds, sips, fundTxns, stocks, trades },
    recurring,
    goals,
    employers,
    payslips,
    pfEntries,
  };
}
