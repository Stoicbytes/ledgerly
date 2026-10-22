import {
  addDays,
  budgetAlerts,
  addMonths,
  categoryBreakdown,
  daysInMonth,
  comparisonRange,
  dayLabel,
  dueEntries,
  monthBounds,
  monthOf,
  ownShare,
  periodTotals,
  projectMonthEnd,
  type Account,
  type MonthProjection,
  type Category,
  type RecurringEntry,
  type Transaction,
} from '@/lib/domain/expenses';
import {
  averageSavingsRate,
  lastSalaryInsight,
  missingPayslipInsight,
  monthTotals,
  pct,
  pfInsights,
  salaryChangeInsight,
  savingsRates,
  spendingPace,
  tdsInsight,
  type Insight,
  type MonthRate,
  type PaceDay,
} from '@/lib/domain/insights';
import type { Employer, Payslip, PfEntry } from '@/lib/domain/salary';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { budgetInsight } from './budgetInsight';

export type { Insight };

export type InsightInput = {
  today: string;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  balances: Map<string, number>;
  rules: RecurringEntry[];
  payslips: Payslip[];
  pfEntries?: PfEntry[];
  employers?: Employer[];
};

const TONE_ORDER = { warn: 0, good: 1, info: 2 } as const;

/** What a credit card is owed: its balance below zero. */
export const cardDue = (accounts: Account[], balances: Map<string, number>) =>
  accounts
    .filter((account) => account.group === 'card')
    .reduce((sum, account) => sum + Math.max(0, -(balances.get(account.id) ?? 0)), 0);

export type MonthPulse = {
  /** Share of this month's income kept so far, in percent; null without income. */
  savingsRate: number | null;
  /** The same over the six full months before; null without income in them. */
  averageRate: number | null;
  /** Spent so far plus what the rest of a month usually costs; null early in the month. */
  projection: MonthProjection | null;
  /** Bank, cash and wallets against the average spend of the last three full months. */
  runway: { months: number; cash: number; monthly: number } | null;
  daysLeft: number;
  /** Day-by-day spending this month against last month's (pace chart). */
  pace: PaceDay[];
  /** Share of income kept in each of the last six months and this one. */
  rates: MonthRate[];
};

/**
 * The month's three headline numbers for the home screen: how much of the income is kept,
 * where spending is heading and how long cash would last. Simple arithmetic on your own
 * entries; nothing is predicted beyond "the rest of a month usually costs this much".
 */
export function monthPulse(input: InsightInput): MonthPulse {
  const { today, transactions, accounts, balances } = input;
  const month = monthOf(today);
  const day = Number(today.slice(8, 10));
  const now = periodTotals(transactions, { start: monthBounds(month).start, end: today });
  const savingsRate = now.income > 0 ? (now.net / now.income) * 100 : null;
  const averageRate = averageSavingsRate(monthTotals(transactions, addMonths(month, -1), 6));
  // From the 5th, so rent on the 1st is not the whole story.
  const projection = day >= 5 && now.expense > 0 ? projectMonthEnd(transactions, today) : null;
  const cash = accounts
    .filter(
      (account) =>
        account.group === 'cash' || account.group === 'bank' || account.group === 'wallet',
    )
    .reduce((sum, account) => sum + Math.max(0, balances.get(account.id) ?? 0), 0);
  const spent = [1, 2, 3].map(
    (back) => periodTotals(transactions, monthBounds(addMonths(month, -back))).expense,
  );
  const monthly = Math.round(spent.reduce((sum, value) => sum + value, 0) / 3);
  const runway = monthly > 0 && cash > 0 ? { months: cash / monthly, cash, monthly } : null;
  return {
    savingsRate,
    averageRate,
    projection,
    runway,
    daysLeft: daysInMonth(month) - day,
    pace: spendingPace(transactions, today),
    rates: savingsRates(transactions, month, 7),
  };
}

/**
 * Rule-based insights for the home screen, most pressing first (at most `limit`). Every
 * figure comes from your own entries. The month's headline numbers are in monthPulse.
 */
export function overviewInsights(input: InsightInput, limit = 10): Insight[] {
  const { today, transactions, categories, accounts, balances } = input;
  const month = monthOf(today);
  const range = { start: monthBounds(month).start, end: today };
  const base = comparisonRange(month, today);
  const now = periodTotals(transactions, range);
  const before = periodTotals(transactions, base);
  const items: Insight[] = [];
  const budget = budgetInsight(budgetAlerts(categories, transactions, today));
  if (budget) items.push(budget);

  const due = cardDue(accounts, balances);
  if (due > 0) {
    items.push({
      id: 'cards',
      tone: 'warn',
      title: `${money(due)} due on credit cards`,
      detail: 'Left out of net worth. Paying a card from a bank account clears it.',
    });
  }

  // Salary and PF, after this month's money and before the general lines.
  const { payslips, pfEntries = [], employers = [] } = input;
  const tds = tdsInsight(payslips, today);
  items.push(
    ...[
      missingPayslipInsight(payslips, employers, today),
      salaryChangeInsight(payslips),
      tds ?? lastSalaryInsight(payslips),
    ].filter((item): item is Insight => item !== null),
    ...pfInsights(pfEntries, payslips, today),
  );

  if (before.expense > 0 && now.expense > 0) {
    const change = ((now.expense - before.expense) / before.expense) * 100;
    if (Math.abs(change) >= 10) {
      items.push({
        id: 'pace',
        tone: change > 0 ? 'warn' : 'good',
        title: `Spending is ${pct(Math.abs(change))} ${change > 0 ? 'higher' : 'lower'} than last month`,
        detail: `${money(now.expense)} so far, against ${money(before.expense)} by ${dayLabel(base.end, 'short')}.`,
      });
    }
  }

  const earlier = new Map(
    categoryBreakdown(transactions, categories, 'expense', base).map((slice) => [
      slice.id,
      slice.amount,
    ]),
  );
  const rise = categoryBreakdown(transactions, categories, 'expense', range)
    .map((slice) => ({ slice, delta: slice.amount - (earlier.get(slice.id) ?? 0) }))
    .filter(({ slice, delta }) => delta >= 1_000_00 && delta >= 0.2 * (earlier.get(slice.id) ?? 0))
    .sort((a, b) => b.delta - a.delta)[0];
  if (rise) {
    items.push({
      id: 'category',
      tone: 'warn',
      title: `${rise.slice.name} is up ${money(rise.delta)} on last month`,
      detail: `${money(rise.slice.amount)} so far, against ${money(earlier.get(rise.slice.id) ?? 0)} at this point last month.`,
    });
  }

  const upcoming = dueEntries(input.rules, addDays(today, 7));
  if (upcoming.length) {
    const overdue = upcoming.filter((item) => item.date < today).length;
    const total = upcoming.reduce((sum, item) => sum + item.rule.amount, 0);
    const next = upcoming[0];
    items.push({
      id: 'recurring',
      tone: overdue ? 'warn' : 'info',
      title: `${upcoming.length} recurring ${upcoming.length === 1 ? 'entry' : 'entries'} due this week`,
      detail: `${money(total)} in all${overdue ? `, ${overdue} overdue` : ''}. Next: ${next.rule.note || 'entry'} on ${dayLabel(next.date, 'short')}.`,
    });
  }

  const largest = transactions
    .filter((item) => item.kind === 'expense' && item.date >= range.start && item.date <= today)
    .sort((a, b) => ownShare(b) - ownShare(a))[0];
  if (largest) {
    const name = categories.find((item) => item.id === largest.categoryId)?.name;
    items.push({
      id: 'largest',
      tone: 'info',
      title: `Largest expense this month: ${money(ownShare(largest))}`,
      detail: `${largest.note || name || 'An entry'} on ${dayLabel(largest.date, 'short')}.`,
    });
  }

  return items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, limit);
}
