import { financialYear } from '../investments/capitalGains';
import type { PfEntry } from './types';

/**
 * PF / EPF arithmetic. The balance is your share (employee + VPF + their interest) and the
 * employer's EPF share, less withdrawals. The pension (EPS) share is shown on its own: it
 * pays a pension later and is not a balance you can withdraw. Interest counts only once it
 * is credited (an interest entry), never before.
 */
export type PfBalance = {
  employee: number;
  employer: number;
  total: number;
  pension: number;
  /** What went in from pay (employee + VPF + employer), opening balances included. */
  contributed: number;
  interest: number;
  withdrawn: number;
};

/** The balance from entries on or before `asOf` (all entries when omitted). */
export function pfBalance(entries: readonly PfEntry[], asOf?: string): PfBalance {
  const balance: PfBalance = {
    employee: 0,
    employer: 0,
    total: 0,
    pension: 0,
    contributed: 0,
    interest: 0,
    withdrawn: 0,
  };
  for (const entry of entries) {
    if (asOf && entry.date > asOf) continue;
    const mine = entry.employee + entry.vpf;
    if (entry.kind === 'withdrawal') {
      balance.employee -= mine;
      balance.employer -= entry.employer;
      balance.withdrawn += mine + entry.employer;
      continue;
    }
    balance.employee += mine;
    balance.employer += entry.employer;
    balance.pension += entry.pension;
    if (entry.kind === 'interest') balance.interest += mine + entry.employer;
    else balance.contributed += mine + entry.employer;
  }
  balance.total = balance.employee + balance.employer;
  return balance;
}

/** The financial year that starts on 1 April of `startYear`: "FY 2025-26" for 2025. */
export const fyLabel = (startYear: number) =>
  `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

/** 1 April of the year a financial year label starts in. */
export const fyStartYear = (fy: string) => Number(fy.slice(3, 7));

export type PfYear = {
  fy: string;
  opening: number;
  contributed: number;
  withdrawn: number;
  /** Credited interest for this year, or null when none is entered yet. */
  interest: number | null;
  rate: number | null;
  closing: number;
  entries: PfEntry[];
};

/** The passbook by financial year, newest first. Pension shares are not included. */
export function pfYears(entries: readonly PfEntry[]): PfYear[] {
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
  );
  const years: PfYear[] = [];
  let running = 0;
  for (const entry of sorted) {
    const fy = financialYear(entry.date);
    let year = years[years.length - 1];
    if (!year || year.fy !== fy) {
      year = {
        fy,
        opening: running,
        contributed: 0,
        withdrawn: 0,
        interest: null,
        rate: null,
        closing: running,
        entries: [],
      };
      years.push(year);
    }
    const amount = entry.employee + entry.vpf + entry.employer;
    if (entry.kind === 'withdrawal') {
      year.withdrawn += amount;
      running -= amount;
    } else {
      if (entry.kind === 'interest') {
        year.interest = (year.interest ?? 0) + amount;
        year.rate = entry.rate;
      } else year.contributed += amount;
      running += amount;
    }
    year.closing = running;
    year.entries.push(entry);
  }
  return years.reverse();
}

/**
 * An estimate of a year's interest at `rate` percent, the way EPFO works it out: on the
 * balance at the end of each month (the balance on 1 April plus contributions for wage months
 * so far and any opening balance carried in, less withdrawals), at a twelfth of the yearly
 * rate, credited once at the year's end.
 * Rounded to the rupee. EPFO's own figure can differ slightly (when a contribution was
 * deposited, the exact rounding), so the credited amount is always entered from the passbook.
 */
export function estimateInterest(entries: readonly PfEntry[], fy: string, rate: number): number {
  const start = fyStartYear(fy);
  const opening = pfBalance(entries, `${start}-03-31`).total;
  let interest = 0;
  for (let index = 0; index < 12; index += 1) {
    const year = index < 9 ? start : start + 1;
    const month = String(((index + 3) % 12) + 1).padStart(2, '0');
    const monthEnd = `${year}-${month}-31`;
    let balance = opening;
    for (const entry of entries) {
      if (entry.kind === 'interest') continue;
      if (entry.date <= `${start}-03-31` || entry.date > monthEnd) continue;
      const amount = entry.employee + entry.vpf + entry.employer;
      balance += entry.kind === 'withdrawal' ? -amount : amount;
    }
    interest += (balance * rate) / 1200;
  }
  return Math.max(0, Math.round(interest / 100) * 100);
}

/**
 * Finished financial years that ended with money in PF but have no interest entered yet,
 * oldest first (so the passbook can be brought up to date year by year). Years without any
 * entry count too: an account keeps earning interest between jobs.
 */
export function yearsWithoutInterest(entries: readonly PfEntry[], today: string): string[] {
  if (!entries.length) return [];
  const first = Math.min(...entries.map((entry) => fyStartYear(financialYear(entry.date))));
  const last = fyStartYear(financialYear(today)) - 1;
  const credited = new Set(
    entries.filter((entry) => entry.kind === 'interest').map((entry) => financialYear(entry.date)),
  );
  const missing: string[] = [];
  for (let year = first; year <= last; year += 1) {
    const fy = fyLabel(year);
    if (!credited.has(fy) && pfBalance(entries, `${year + 1}-03-31`).total > 0) missing.push(fy);
  }
  return missing;
}

/** Contributions per employer, for "where your PF came from". */
export function contributionsByEmployer(entries: readonly PfEntry[]) {
  const totals = new Map<
    string,
    { employerId: string; months: number; amount: number; pension: number }
  >();
  for (const entry of entries) {
    if (entry.kind !== 'contribution' || !entry.employerId) continue;
    const item = totals.get(entry.employerId) ?? {
      employerId: entry.employerId,
      months: 0,
      amount: 0,
      pension: 0,
    };
    item.months += 1;
    item.amount += entry.employee + entry.vpf + entry.employer;
    item.pension += entry.pension;
    totals.set(entry.employerId, item);
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount);
}
