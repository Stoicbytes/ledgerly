import { addDays, addMonths, monthOf } from '../expenses/dates';
import type { FundTxn, Sip } from './types';

const pad = (value: number) => String(value).padStart(2, '0');

/** Instalment dates of a SIP between two dates (inclusive), oldest first. */
export function sipDates(sip: Sip, from: string, to: string): string[] {
  const start = sip.startDate > from ? sip.startDate : from;
  const end = sip.endDate && sip.endDate < to ? sip.endDate : to;
  const dates: string[] = [];
  let month = monthOf(start);
  while (`${month}-01` <= end) {
    const date = `${month}-${pad(sip.day)}`;
    if (date >= start && date <= end && date >= sip.startDate) dates.push(date);
    month = addMonths(month, 1);
  }
  return dates;
}

/** Next instalment on or after `today`, or null when the SIP has ended or is paused. */
export function nextSipDate(sip: Sip, today: string): string | null {
  if (!sip.active) return null;
  return sipDates(sip, today, addDays(today, 62))[0] ?? null;
}

export type UpcomingSip = { sip: Sip; date: string };

/** Active SIPs due in the next `days` days, soonest first. */
export function upcomingSips(sips: Sip[], today: string, days = 31): UpcomingSip[] {
  const until = addDays(today, days);
  return sips
    .map((sip) => ({ sip, date: nextSipDate(sip, today) }))
    .filter((item): item is UpcomingSip => !!item.date && item.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Instalments due in the last `lookbackDays` with no purchase of that fund near the date
 * (NAV allotment can take a few days): the "record it" list. A purchase counts whether or
 * not it is linked to the SIP, so instalments brought in by a tradebook import are not
 * asked for again.
 */
export function pendingSipInstalments(
  sips: Sip[],
  txns: FundTxn[],
  today: string,
  lookbackDays = 45,
): UpcomingSip[] {
  const from = addDays(today, -lookbackDays);
  const pending: UpcomingSip[] = [];
  for (const sip of sips) {
    if (!sip.active) continue;
    const linked = txns.filter(
      (txn) =>
        txn.kind === 'buy' &&
        (txn.sipId === sip.id || (txn.sipId === null && txn.fundId === sip.fundId)),
    );
    for (const date of sipDates(sip, from, today)) {
      const covered = linked.some(
        (txn) => txn.date >= addDays(date, -5) && txn.date <= addDays(date, 10),
      );
      if (!covered) pending.push({ sip, date });
    }
  }
  return pending.sort((a, b) => a.date.localeCompare(b.date));
}

/** Monthly total of active SIPs, paise. */
export const monthlySipTotal = (sips: Sip[], today: string) =>
  sips
    .filter((sip) => sip.active && (!sip.endDate || sip.endDate >= today))
    .reduce((sum, sip) => sum + sipAmountOn(sip, today), 0);

/** Whole years from the SIP's start to `date` (the step-up count). */
const yearsSince = (start: string, date: string) => {
  const years = Number(date.slice(0, 4)) - Number(start.slice(0, 4));
  return Math.max(0, date.slice(5) < start.slice(5) ? years - 1 : years);
};

/**
 * The instalment on `date`: the amount raised by the yearly step-up once for every full
 * year since the start (₹5,000 with 10 %: ₹5,500 in the second year, ₹6,050 in the third).
 */
export function sipAmountOn(sip: Sip, date: string): number {
  const step = (sip.stepUpPct ?? 0) / 100;
  return step ? Math.round(sip.amount * (1 + step) ** yearsSince(sip.startDate, date)) : sip.amount;
}

/** Monthly instalment for each of the next `years` years, from the start. */
export function stepUpSchedule(amount: number, stepUpPct: number, years: number): number[] {
  return Array.from({ length: years }, (_, year) =>
    Math.round(amount * (1 + stepUpPct / 100) ** year),
  );
}

/**
 * Money put in over `years` years of monthly instalments with the step-up, and what it
 * would grow to at `yearlyReturn` percent a year (invested at the end of each month).
 */
export function stepUpProjection(
  amount: number,
  stepUpPct: number,
  years: number,
  yearlyReturn: number,
) {
  const monthly = yearlyReturn / 100 / 12;
  let invested = 0;
  let value = 0;
  stepUpSchedule(amount, stepUpPct, years).forEach((instalment) => {
    for (let month = 0; month < 12; month += 1) {
      value = value * (1 + monthly) + instalment;
      invested += instalment;
    }
  });
  return { invested, value: Math.round(value) };
}
