import { addMonths, monthLabel } from '../expenses';

/** What a report covers: a month, a calendar year, or an Indian financial year (Apr–Mar). */
export type PeriodKind = 'month' | 'year' | 'fy';

export type ReportPeriod = {
  kind: PeriodKind;
  /** Inclusive dates, YYYY-MM-DD. */
  start: string;
  end: string;
  /** Months covered, YYYY-MM, oldest first. */
  months: string[];
  label: string;
};

const lastDay = (month: string) =>
  `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;

function build(kind: PeriodKind, first: string, count: number): ReportPeriod {
  const months = Array.from({ length: count }, (_, i) => addMonths(first, i));
  const year = Number(first.slice(0, 4));
  const label =
    kind === 'month'
      ? monthLabel(first)
      : kind === 'year'
        ? String(year)
        : `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  return { kind, start: `${first}-01`, end: lastDay(months[months.length - 1]), months, label };
}

/** The period of `kind` that contains `date`. */
export function reportPeriod(kind: PeriodKind, date: string): ReportPeriod {
  const month = date.slice(0, 7);
  if (kind === 'month') return build(kind, month, 1);
  const year = Number(date.slice(0, 4));
  if (kind === 'year') return build(kind, `${year}-01`, 12);
  const fyStart = Number(date.slice(5, 7)) >= 4 ? year : year - 1;
  return build(kind, `${fyStart}-04`, 12);
}

/** The same kind of period `steps` before (negative) or after. */
export function shiftPeriod(period: ReportPeriod, steps: number): ReportPeriod {
  const size = period.months.length;
  return build(period.kind, addMonths(period.months[0], steps * size), size);
}

const DAY = 86_400_000;
const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * The period to compare with: the one before, cut to as many days as have passed when `today`
 * falls inside `period` (so a month in progress is compared with the same days of the last).
 */
export function comparisonPeriod(period: ReportPeriod, today?: string): ReportPeriod {
  const before = shiftPeriod(period, -1);
  if (!today || today < period.start || today >= period.end) return before;
  const elapsed = Math.round((toTime(today) - toTime(period.start)) / DAY);
  const end = new Date(toTime(before.start) + elapsed * DAY).toISOString().slice(0, 10);
  return { ...before, end: end < before.end ? end : before.end };
}
