/**
 * Pure parsers for the market-refresh function (no network, no Deno APIs), so they are
 * unit-tested on their own. Each one is strict about what it keeps and skips anything
 * it does not recognise, so a format change shows up as "0 rows" rather than bad data.
 */

export type SchemeRow = {
  scheme_code: number;
  name: string;
  fund_house: string;
  category: string;
  isin_growth: string | null;
  isin_reinvest: string | null;
  nav: number | null;
  nav_date: string | null;
};

export type PriceRow = {
  isin: string;
  symbol: string;
  name: string;
  series: string;
  /** Paise per share. */
  close: number;
  prev_close: number | null;
};

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const SYMBOL = /^[A-Z0-9&._-]{1,30}$/;

function validDate(iso: string): string | null {
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

/** "07-Oct-2026", "07-OCT-2026", "2026-10-07" or "07-10-2026" → "2026-10-07". */
export function toIsoDate(value: string): string | null {
  const text = value.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) return validDate(text);
  match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    return month ? validDate(`${match[3]}-${month}-${match[1].padStart(2, "0")}`) : null;
  }
  match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(text);
  if (match) {
    return validDate(`${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`);
  }
  return null;
}

const cleanIsin = (value: string | undefined): string | null => {
  const text = (value ?? "").trim().toUpperCase();
  return ISIN.test(text) ? text : null;
};

const decimal = (value: string | undefined, places: number): number | null => {
  const text = (value ?? "").trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0) return null;
  const factor = 10 ** places;
  return Math.round(number * factor) / factor;
};

/**
 * AMFI's NAVAll.txt: a header line, then blocks of
 *   "Open Ended Schemes(Equity Scheme - Large Cap Fund)"   ← category
 *   "Axis Mutual Fund"                                     ← fund house
 *   "120465;INF846K01DP8;-;Axis Bluechip Fund - Direct Plan - Growth;58.1200;07-Oct-2026"
 * separated by blank lines. NAV can be "N.A." for schemes that did not publish one.
 */
export function parseAmfi(text: string): { rows: SchemeRow[]; latestDate: string | null } {
  const rows: SchemeRow[] = [];
  const seen = new Set<number>();
  let category = "";
  let fundHouse = "";
  let latestDate: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes(";")) {
      const parts = line.split(";").map((part) => part.trim());
      if (parts.length < 6 || !/^\d{1,9}$/.test(parts[0])) continue;
      const code = Number(parts[0]);
      const name = parts[3].replace(/\s+/g, " ").slice(0, 200);
      if (!code || !name || seen.has(code)) continue;
      seen.add(code);
      const navDate = toIsoDate(parts[5]);
      const nav = decimal(parts[4], 4);
      if (navDate && nav && (!latestDate || navDate > latestDate)) latestDate = navDate;
      rows.push({
        scheme_code: code,
        name,
        fund_house: fundHouse,
        category,
        isin_growth: cleanIsin(parts[1]),
        isin_reinvest: cleanIsin(parts[2]),
        nav,
        nav_date: nav ? navDate : null,
      });
      continue;
    }
    const heading = /^(?:Open[- ]Ended|Close[- ]Ended|Interval Fund) Schemes\s*\((.*)\)$/i.exec(
      line,
    );
    if (heading) {
      category = heading[1].replace(/\s+/g, " ").trim().slice(0, 160);
      fundHouse = "";
    } else {
      fundHouse = line.replace(/\s+/g, " ").slice(0, 120);
    }
  }
  return { rows, latestDate };
}

/** Splits one CSV line, honouring double quotes ("a,b" and "" escapes). */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

// Column names in the exchanges' UDiFF bhavcopy (since July 2024), then the older names.
const COLUMNS = {
  isin: ["isin", "isin_code", "isin code"],
  symbol: ["tckrsymb", "symbol"],
  name: ["fininstrmnm", "sc_name", "name of security"],
  series: ["sctysrs", "series"],
  type: ["fininstrmtp"],
  close: ["clspric", "close", "close_price"],
  prev: ["prvsclsgpric", "prevclose", "prev_close", "prevclose_price"],
  date: ["traddt", "timestamp", "trade_date"],
} as const;

/** NSE equity series kept: rolling settlement, trade-for-trade and SME boards. */
const NSE_SERIES = new Set(["EQ", "BE", "BZ", "SM", "ST"]);

/**
 * The exchange end-of-day file (bhavcopy). Columns are found by name, so the order can
 * change. Keeps equity shares only; prices become paise.
 */
export function parseBhavcopy(
  csv: string,
  exchange: "NSE" | "BSE",
): { rows: PriceRow[]; tradeDate: string | null } {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], tradeDate: null };
  const header = splitCsvLine(lines[0]).map((cell) => cell.replace(/^﻿/, "").toLowerCase());
  const find = (names: readonly string[]) => header.findIndex((cell) => names.includes(cell));
  const at = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, names]) => [key, find(names)]),
  ) as Record<keyof typeof COLUMNS, number>;
  if (at.isin < 0 || at.symbol < 0 || at.close < 0) return { rows: [], tradeDate: null };
  const rows: PriceRow[] = [];
  let tradeDate: string | null = null;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    if (at.type >= 0 && cells[at.type] && cells[at.type].toUpperCase() !== "STK") continue;
    const series = at.series >= 0 ? (cells[at.series] ?? "").toUpperCase() : "";
    if (exchange === "NSE" && at.series >= 0 && !NSE_SERIES.has(series)) continue;
    const isin = cleanIsin(cells[at.isin]);
    const symbol = (cells[at.symbol] ?? "").trim().toUpperCase();
    const close = decimal(cells[at.close], 2);
    if (!isin || !SYMBOL.test(symbol) || !close) continue;
    const prev = at.prev >= 0 ? decimal(cells[at.prev], 2) : null;
    if (!tradeDate && at.date >= 0) tradeDate = toIsoDate(cells[at.date] ?? "");
    rows.push({
      isin,
      symbol,
      name: at.name >= 0 ? (cells[at.name] ?? "").replace(/\s+/g, " ").slice(0, 200) : "",
      series: series.slice(0, 4),
      close: Math.round(close * 100),
      prev_close: prev ? Math.round(prev * 100) : null,
    });
  }
  return { rows, tradeDate };
}

/**
 * mfapi.in scheme history ({ data: [{ date: "07-10-2026", nav: "58.12000" }] }) →
 * [[iso date, nav], …] from `since` onwards, oldest first.
 */
export function parseMfapiHistory(body: unknown, since: string | null): [string, number][] {
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const points: [string, number][] = [];
  for (const item of data) {
    const date = toIsoDate(String((item as { date?: unknown })?.date ?? ""));
    const nav = decimal(String((item as { nav?: unknown })?.nav ?? ""), 4);
    if (date && nav && (!since || date >= since)) points.push([date, nav]);
  }
  return points.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** Today's date in India (YYYY-MM-DD). */
export function indiaToday(now: Date): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** `count` weekdays ending at `fromIso` (inclusive), newest first. */
export function recentWeekdays(fromIso: string, count: number): string[] {
  const days: string[] = [];
  const cursor = new Date(`${fromIso}T00:00:00Z`);
  while (days.length < count) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days;
}

/** ISO date minus `days` days. */
export function minusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Splits a list into chunks (large upserts go in several requests). */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** Constant-time comparison for the schedule secret. */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

/**
 * Whether a browser origin may call the function. An entry may hold one "*", which stands
 * for letters, digits and hyphens only (one part of a host name, never a dot), so
 * "https://app-*-team.vercel.app" admits that project's preview deployments and nothing else.
 */
export function originAllowed(origin: string, allowed: string[]): boolean {
  return allowed.some((entry) => {
    if (!entry.includes("*")) return entry === origin;
    const [before, after] = entry.split("*", 2);
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${escape(before)}[a-z0-9-]+${escape(after)}$`).test(origin);
  });
}
