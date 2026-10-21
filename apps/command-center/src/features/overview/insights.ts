import {
  addDays,
  budgetAlerts,
  addMonths,
  categoryBreakdown,
  comparisonRange,
  dayLabel,
  dueEntries,
  monthBounds,
  monthLabel,
  monthOf,
  ownShare,
  periodTotals,
  projectMonthEnd,
  type Account,
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
  tdsInsight,
  type Insight,
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

/**
 * Rule-based insights for the home screen, most pressing first (at most `limit`). Every
 * figure comes from your own entries; nothing is predicted beyond simple arithmetic
 * (the month-end figure is spent so far plus what the rest of a month usually costs).
 */
export function overviewInsights(input: InsightInput, limit = 6): Insight[] {
  const { today, transactions, categories, accounts, balances } = input;
  const month = monthOf(today);
  const day = Number(today.slice(8, 10));
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

  if (now.income > 0) {
    const rate = (now.net / now.income) * 100;
    // Against the six full months before this one, income and spending together.
    const average = averageSavingsRate(monthTotals(transactions, addMonths(month, -1), 6));
    items.push({
      id: 'savings-rate',
      tone: rate >= 20 ? 'good' : rate < 0 ? 'warn' : 'info',
      title:
        rate < 0
          ? `${money(-now.net)} more spent than earned this month`
          : `You kept ${pct(rate)} of this month's income`,
      detail: `${money(now.income)} in, ${money(now.expense)} out so far${
        average === null ? '' : `; ${pct(average)} on average over the last 6 months`
      }.`,
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

  // Spent so far plus what the rest of a month usually costs, so rent on the 1st is not
  // multiplied over the month.
  const course = day >= 5 && now.expense > 0 ? projectMonthEnd(transactions, today) : null;
  if (course) {
    items.push({
      id: 'projection',
      tone: 'info',
      title: `On course to spend about ${money(course.projected)} in ${monthLabel(month, 'short')}`,
      detail: `${money(course.spent)} so far; the rest of a month usually costs about ${money(course.rest)}.`,
    });
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

  // Cash on hand against the average spend of the last three full months.
  const cash = accounts
    .filter(
      (account) =>
        account.group === 'cash' || account.group === 'bank' || account.group === 'wallet',
    )
    .reduce((sum, account) => sum + Math.max(0, balances.get(account.id) ?? 0), 0);
  const spent = [1, 2, 3].map(
    (back) => periodTotals(transactions, monthBounds(addMonths(month, -back))).expense,
  );
  const average = spent.reduce((sum, value) => sum + value, 0) / 3;
  if (average > 0 && cash > 0) {
    const months = cash / average;
    items.push({
      id: 'runway',
      tone: months >= 6 ? 'good' : months < 3 ? 'warn' : 'info',
      title: `Your cash covers ${months.toFixed(1)} months of spending`,
      detail: `${money(cash)} in bank, cash and wallets; about ${money(Math.round(average))} spent a month lately.`,
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
