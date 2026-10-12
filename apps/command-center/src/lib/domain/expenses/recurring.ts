import { addDays, daysInMonth } from './dates';
import type { TransactionKind } from './types';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * An entry that repeats: rent, a subscription, an EMI, a SIP transfer. Nothing is added
 * by itself; each due date waits until you add it (amount can be changed) or skip it.
 */
export type RecurringEntry = {
  id: string;
  kind: TransactionKind;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  fee: number;
  categoryId: string | null;
  note: string;
  frequency: RecurringFrequency;
  /** First date; monthly and yearly dates keep its day (31st → last day of shorter months). */
  startDate: string;
  /** The next date not yet added or skipped. */
  nextDate: string;
  createdAt: number;
};

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

const monthIndex = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;

/** The date `months` months after `start`, on the same day or the month's last day. */
function shiftMonths(start: string, months: number): string {
  const index = monthIndex(start) + months;
  const month = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  const day = Math.min(Number(start.slice(8, 10)), daysInMonth(month));
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** The first date of the rule after `date`. */
export function followingDate(
  rule: Pick<RecurringEntry, 'frequency' | 'startDate'>,
  date: string,
): string {
  if (date < rule.startDate) return rule.startDate;
  switch (rule.frequency) {
    case 'daily':
      return addDays(date, 1);
    case 'weekly': {
      const start = new Date(`${rule.startDate}T12:00:00Z`).getTime();
      const current = new Date(`${date}T12:00:00Z`).getTime();
      const weeks = Math.floor(Math.round((current - start) / 86_400_000) / 7) + 1;
      return addDays(rule.startDate, weeks * 7);
    }
    case 'monthly':
    case 'yearly': {
      const step = rule.frequency === 'monthly' ? 1 : 12;
      let count = Math.floor((monthIndex(date) - monthIndex(rule.startDate)) / step);
      let next = shiftMonths(rule.startDate, count * step);
      while (next <= date) next = shiftMonths(rule.startDate, ++count * step);
      return next;
    }
  }
}

/** Dates due up to `today` (oldest first), at most `limit` of them. */
export function dueDates(rule: RecurringEntry, today: string, limit = 12): string[] {
  const dates: string[] = [];
  let date = rule.nextDate;
  while (date <= today && dates.length < limit) {
    dates.push(date);
    date = followingDate(rule, date);
  }
  return dates;
}

export type DueEntry = { rule: RecurringEntry; date: string };

/** Everything due up to today across all rules, oldest first. */
export function dueEntries(rules: RecurringEntry[], today: string): DueEntry[] {
  return rules
    .flatMap((rule) => dueDates(rule, today).map((date) => ({ rule, date })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.rule.createdAt - b.rule.createdAt);
}
