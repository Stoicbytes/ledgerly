import { addDays, parseIsoDate } from '../expenses/dates';
import type { RefreshRun } from './types';

export type PriceKind = 'funds' | 'stocks';

const SOURCES: Record<PriceKind, RefreshRun['source'][]> = {
  funds: ['amfi'],
  stocks: ['nse', 'bse'],
};

/**
 * The last weekday before `today`: the newest NAVs and closing prices that are surely
 * published by now (today's come out in the evening). Exchange holidays are not known
 * here, so the day after a holiday may warn once.
 */
export function lastTradingDay(today: string): string {
  let day = addDays(today, -1);
  while ([0, 6].includes(parseIsoDate(day).getDay())) day = addDays(day, -1);
  return day;
}

/** A run's message made safe to show: no web addresses or long keys, one short line. */
export function cleanRunMessage(message: string): string {
  const text = message
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[A-Za-z0-9_\-.=]{32,}/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}

export type PriceFreshness = {
  /** Date of the newest prices stored (null when none were ever fetched). */
  dataDate: string | null;
  source: RefreshRun['source'] | null;
  /** Older than the last trading day. */
  stale: boolean;
  /** The newest update run failed: its cleaned message (or a plain fallback). */
  failure: string | null;
};

/** How current the stored NAVs (funds) or closing prices (stocks) are, from load_market's runs. */
export function priceFreshness(runs: RefreshRun[], kind: PriceKind, today: string): PriceFreshness {
  const own = runs.filter((run) => SOURCES[kind].includes(run.source));
  const ok = own
    .filter((run) => run.status === 'ok' && run.dataDate)
    .sort((a, b) => (b.dataDate ?? '').localeCompare(a.dataDate ?? ''))[0];
  const newest = [...own].sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0];
  const failed =
    newest?.status === 'failed' && (!ok || (newest.finishedAt ?? '') > (ok.finishedAt ?? ''));
  return {
    dataDate: ok?.dataDate ?? null,
    source: ok?.source ?? null,
    stale: !!ok?.dataDate && ok.dataDate < lastTradingDay(today),
    failure: failed ? cleanRunMessage(newest.message) || 'No details were recorded.' : null,
  };
}
