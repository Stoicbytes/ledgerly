import type { LedgerData } from './types';
import { assert } from './guard';

/**
 * Rules across fields and records that the database also enforces: ids are unique,
 * every reference points at a record in the same file, and the per-kind rules hold
 * (a transfer has a destination, a split belongs to an expense, …). A file that breaks
 * one is refused as a whole, so a restore never stops halfway on a rejected record.
 */
type Ids = Set<string>;

function idsOf(path: string, items: readonly { id: string }[] | undefined): Ids {
  const ids = new Set<string>();
  for (const item of items ?? []) {
    assert(!ids.has(item.id), `${path} ${item.id}`, 'appears twice');
    ids.add(item.id);
  }
  return ids;
}

const ref = (ids: Ids, id: string | null | undefined, path: string, what: string) =>
  assert(id === null || id === undefined || ids.has(id), path, `refers to ${what} not in the file`);

export function checkRules(data: LedgerData): void {
  const { portfolio } = data;
  const accounts = idsOf('Account', data.accounts);
  const categories = idsOf('Category', data.categories);
  const people = idsOf('Person', data.people);
  const transactions = idsOf('Entry', data.transactions);
  idsOf('Note', data.notes);
  idsOf('Recurring entry', data.recurring);
  const goals = idsOf('Goal', data.goals);
  const employers = idsOf('Employer', data.employers);
  const payslips = idsOf('Payslip', data.payslips);
  idsOf('PF entry', data.pfEntries);
  const funds = idsOf('Fund', portfolio.funds);
  const sips = idsOf('SIP', portfolio.sips);
  idsOf('Fund transaction', portfolio.fundTxns);
  const stocks = idsOf('Share', portfolio.stocks);
  idsOf('Trade', portfolio.trades);

  const categoryKind = new Map(data.categories.map((item) => [item.id, item]));
  for (const c of data.categories) {
    const path = `Category ${c.id}`;
    ref(categories, c.parentId, path, 'a category');
    const parent = c.parentId ? categoryKind.get(c.parentId) : null;
    assert(
      !parent || (parent.parentId === null && parent.kind === c.kind),
      path,
      'has a bad parent',
    );
    assert(
      c.budget === null || (c.parentId === null && c.kind === 'expense'),
      path,
      'has a budget',
    );
  }

  const entries = [...data.transactions, ...(data.recurring ?? [])];
  for (const t of entries) {
    const path = `Entry ${t.id}`;
    ref(accounts, t.accountId, path, 'an account');
    ref(accounts, t.toAccountId, path, 'an account');
    ref(categories, t.categoryId, path, 'a category');
    const transfer = t.kind === 'transfer';
    assert(
      transfer
        ? t.toAccountId !== null && t.toAccountId !== t.accountId && t.categoryId === null
        : t.toAccountId === null && t.fee === 0,
      path,
      'breaks the transfer rules',
    );
    const category = t.categoryId ? categoryKind.get(t.categoryId) : null;
    assert(!category || category.kind === t.kind, path, 'has a category of another type');
  }
  const byId = new Map(data.transactions.map((item) => [item.id, item]));
  for (const t of data.transactions) {
    const path = `Entry ${t.id}`;
    const personId = t.personId ?? null;
    ref(people, personId, path, 'a person');
    assert(
      personId === null || (t.kind === 'income' && t.categoryId === null),
      path,
      'is a bad repayment',
    );
    const splits = t.splits ?? [];
    for (const split of splits) ref(people, split.personId, path, 'a person');
    assert(new Set(splits.map((s) => s.personId)).size === splits.length, path, 'splits twice');
    assert(!splits.length || t.kind === 'expense', path, 'is split but not an expense');
    assert(splits.reduce((sum, s) => sum + s.amount, 0) <= t.amount, path, 'splits too much');
    for (const id of t.settles ?? []) {
      ref(transactions, id, path, 'an entry');
      assert(id !== t.id && !(byId.get(id)?.settles ?? []).length, path, 'settles a repayment');
    }
  }
  for (const r of data.recurring ?? []) {
    assert(r.nextDate >= r.startDate, `Recurring entry ${r.id}`, 'ends before it starts');
  }

  for (const f of portfolio.funds) {
    ref(goals, f.goalId, `Fund ${f.id}`, 'a goal');
    assert((f.manualNav === null) === (f.manualNavDate === null), `Fund ${f.id}`, 'has half a NAV');
  }
  for (const s of portfolio.sips) {
    ref(funds, s.fundId, `SIP ${s.id}`, 'a fund');
    assert(s.endDate === null || s.endDate >= s.startDate, `SIP ${s.id}`, 'ends before it starts');
  }
  const sipFund = new Map(portfolio.sips.map((s) => [s.id, s.fundId]));
  for (const t of portfolio.fundTxns) {
    const path = `Fund transaction ${t.id}`;
    ref(funds, t.fundId, path, 'a fund');
    ref(sips, t.sipId, path, 'a SIP');
    assert(
      t.sipId === null || sipFund.get(t.sipId) === t.fundId,
      path,
      'has a SIP of another fund',
    );
    const dividend = t.kind === 'dividend';
    assert(
      dividend
        ? t.units === null && t.nav === null && t.stampDuty === 0 && t.sipId === null
        : t.units !== null && t.nav !== null,
      path,
      'breaks the fund rules',
    );
    assert(
      (t.kind === 'buy' || (t.stampDuty === 0 && t.sipId === null)) && t.stampDuty < t.amount,
      path,
      'has bad stamp duty',
    );
  }
  for (const s of portfolio.stocks) {
    assert(
      (s.manualPrice === null) === (s.manualPriceDate === null),
      `Share ${s.id}`,
      'has half a price',
    );
  }
  for (const t of portfolio.trades) {
    const path = `Trade ${t.id}`;
    ref(stocks, t.stockId, path, 'a share');
    const ratio = t.ratioFrom !== null && t.ratioTo !== null;
    const noRatio = t.ratioFrom === null && t.ratioTo === null;
    const trade = t.quantity !== null && t.price !== null && t.amount === null && noRatio;
    const corporate =
      t.quantity === null && t.price === null && t.amount === null && t.charges === 0;
    const ok =
      t.kind === 'buy' || t.kind === 'sell'
        ? trade
        : t.kind === 'bonus'
          ? corporate && ratio
          : t.kind === 'split'
            ? corporate && ratio && t.ratioFrom !== t.ratioTo
            : t.quantity === null &&
              t.price === null &&
              t.amount !== null &&
              noRatio &&
              t.charges === 0;
    assert(ok, path, 'breaks the trade rules');
  }

  for (const e of data.employers ?? []) {
    const ok = e.leftOn === null || e.joinedOn === null || e.leftOn >= e.joinedOn;
    assert(ok, `Employer ${e.id}`, 'left before joining');
  }
  const months = new Set<string>();
  const total = (lines: { amount: number }[]) => lines.reduce((sum, line) => sum + line.amount, 0);
  for (const p of data.payslips ?? []) {
    const path = `Payslip ${p.id}`;
    ref(employers, p.employerId, path, 'an employer');
    ref(transactions, p.transactionId, path, 'an entry');
    assert(!months.has(`${p.employerId} ${p.month}`), path, 'repeats a month');
    months.add(`${p.employerId} ${p.month}`);
    const net = total(p.earnings) - total(p.deductions) - p.epfEmployee - p.vpf - p.tds;
    assert(net >= 0, path, 'has deductions above earnings');
  }
  const fromPayslip = new Set<string>();
  for (const f of data.pfEntries ?? []) {
    const path = `PF entry ${f.id}`;
    ref(employers, f.employerId, path, 'an employer');
    ref(payslips, f.payslipId, path, 'a payslip');
    if (f.payslipId) {
      assert(!fromPayslip.has(f.payslipId), path, 'repeats a payslip');
      fromPayslip.add(f.payslipId);
    }
    const plain = f.vpf === 0 && f.payslipId === null;
    const ok =
      f.employee + f.vpf + f.employer + f.pension > 0 &&
      (f.kind === 'contribution'
        ? f.employerId !== null && f.date.endsWith('-01') && f.rate === null
        : f.kind === 'interest'
          ? f.rate !== null && plain && f.pension === 0
          : f.kind === 'withdrawal'
            ? plain && f.pension === 0 && f.rate === null
            : plain && f.rate === null);
    assert(ok, path, 'breaks the PF rules');
  }
}
