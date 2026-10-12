import { keepsUnitsCovered } from './forms';
import { replayFund } from './funds';
import { fromUnits4, toUnits4 } from './math';
import { replayStock } from './stocks';
import type { TradebookSegment, TradebookTrade } from './tradebook';
import { keepsSharesCovered } from './tradeForms';
import { withIds, type KnownTrade } from './importDuplicates';
import { amountOf, asFundTxn, asTrade } from './importRows';
import type { Fund, FundTxn, Portfolio, Stock, Trade } from './types';

/**
 * What importing a tradebook would change, holding by holding, before anything is saved:
 * the trades to add, the ones already in the app (same date, side, quantity and price),
 * the ones left out because they sell units bought before the file starts, and units or
 * shares and invested amount before and after.
 */
export type PlannedTrade = {
  /** Unique within the import: the holding's key and the trade's place in it. */
  id: string;
  date: string;
  kind: 'buy' | 'sell';
  quantity: number;
  price: number;
  /** Paise: quantity × price, as the broker shows it (stamp duty and charges are not listed). */
  amount: number;
  /** Why it may already be in the app under other figures; null when it looks new. */
  duplicate: string | null;
};

export type HoldingPlan = {
  key: string;
  segment: TradebookSegment;
  /** The ISIN of the newest trade (a split or bonus can give a share a new ISIN). */
  isin: string;
  /** Every ISIN the holding's trades carry, oldest first. */
  isins: string[];
  name: string;
  symbol: string;
  exchange: 'NSE' | 'BSE';
  /** The fund or stock already in the app, if any. */
  existingId: string | null;
  add: PlannedTrade[];
  already: number;
  leftOut: PlannedTrade[];
  /** Units (funds, 4 decimals) or shares; invested and realised in paise. */
  before: { held: number; invested: number };
  after: { held: number; invested: number; realised: number };
};

export type Additions = { funds: Fund[]; fundTxns: FundTxn[]; stocks: Stock[]; trades: Trade[] };

/** "PARAG PARIKH FLEXI CAP FUND - DIRECT PLAN" and "Parag Parikh Flexi Cap Fund - Direct Growth" match. */
export const fundNameKey = (name: string) =>
  name
    .toLowerCase()
    .split(/\b(?:direct|regular)\b/)[0]
    .replace(/[^a-z0-9]/g, '');

const titleCase = (value: string) =>
  value.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase());

const fundKey = (t: { date: string; kind: string; units: number | null; nav: number | null }) =>
  `${t.date}|${t.kind}|${toUnits4(t.units ?? 0)}|${Math.round((t.nav ?? 0) * 10000)}`;
const stockKey = (t: {
  date: string;
  kind: string;
  quantity: number | null;
  price: number | null;
}) => `${t.date}|${t.kind}|${t.quantity ?? 0}|${t.price ?? 0}`;

/**
 * Splits candidates into already recorded and new (as a multiset: two equal trades count
 * twice), and returns the recorded trades nothing matched.
 */
function splitKnown<T, E>(
  candidates: T[],
  existing: E[],
  keyOf: (item: T) => string,
  existingKey: (item: E) => string,
) {
  const pool = new Map<string, E[]>();
  for (const item of existing) {
    const key = existingKey(item);
    pool.set(key, [...(pool.get(key) ?? []), item]);
  }
  const fresh: T[] = [];
  let already = 0;
  for (const item of candidates) {
    const left = pool.get(keyOf(item));
    if (left?.length) {
      left.shift();
      already += 1;
    } else fresh.push(item);
  }
  return { fresh, already, leftover: [...pool.values()].flat() };
}

/** The fewest leading new trades to leave out so that no sale exceeds what is held. */
function firstConsistent<T>(fresh: T[], fits: (kept: T[]) => boolean): number {
  for (let skip = 0; skip <= fresh.length; skip += 1) if (fits(fresh.slice(skip))) return skip;
  return fresh.length;
}

const planned = (trade: TradebookTrade): Omit<PlannedTrade, 'id' | 'duplicate'> => ({
  date: trade.date,
  kind: trade.kind,
  quantity: trade.quantity,
  price: trade.price,
  amount: amountOf(trade),
});

function mainExchange(trades: TradebookTrade[]): 'NSE' | 'BSE' {
  const bse = trades.filter((trade) => trade.exchange === 'BSE').length;
  return bse > trades.length - bse ? 'BSE' : 'NSE';
}

export function planImport(trades: TradebookTrade[], portfolio: Portfolio): HoldingPlan[] {
  const groups = new Map<string, TradebookTrade[]>();
  for (const trade of trades) {
    // Shares are grouped by symbol: a split often gives the share a new ISIN, and one
    // holding must not become two stocks with the same symbol (the database refuses it).
    const key =
      trade.segment === 'equity'
        ? `equity:${trade.symbol.toUpperCase()}`
        : `${trade.segment}:${trade.isin}`;
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }
  const plans: HoldingPlan[] = [];
  for (const [key, unsorted] of groups) {
    const group = [...unsorted].sort((a, b) => a.date.localeCompare(b.date));
    const { segment } = group[0];
    const isin = group[group.length - 1].isin;
    const isins = [...new Set(group.map((trade) => trade.isin))];
    const symbol = group[group.length - 1].symbol;
    if (segment === 'funds') {
      const byName = portfolio.funds.filter(
        (f) => !f.isin && fundNameKey(f.name) === fundNameKey(symbol),
      );
      const fund =
        portfolio.funds.find((f) => f.isin === isin) ??
        (byName.length === 1 ? byName[0] : undefined);
      const existing = fund ? portfolio.fundTxns.filter((t) => t.fundId === fund.id) : [];
      const { fresh, already, leftover } = splitKnown(
        group,
        existing.filter((t) => t.kind !== 'dividend'),
        (t) => fundKey({ ...t, units: t.quantity, nav: t.price }),
        fundKey,
      );
      const known: KnownTrade[] = leftover.map((t) => ({
        date: t.date,
        kind: t.kind,
        quantity: t.units ?? 0,
        price: t.nav ?? 0,
      }));
      const asTxns = (list: TradebookTrade[]) => list.map((t, i) => asFundTxn(t, 'new', `n${i}`));
      const skip = firstConsistent(fresh, (kept) =>
        keepsUnitsCovered([...existing, ...asTxns(kept)]),
      );
      const before = replayFund(existing);
      const after = replayFund([...existing, ...asTxns(fresh.slice(skip))]);
      plans.push({
        key,
        segment,
        isin,
        isins,
        name: fund?.name ?? titleCase(symbol),
        symbol,
        exchange: mainExchange(group),
        existingId: fund?.id ?? null,
        add: withIds(key, fresh.slice(skip).map(planned), known, (nav) => `NAV ₹${nav}`),
        already,
        leftOut: withIds(key, fresh.slice(0, skip).map(planned), [], String),
        before: { held: fromUnits4(before.units4), invested: before.invested },
        after: {
          held: fromUnits4(after.units4),
          invested: after.invested,
          realised: after.realised,
        },
      });
    } else {
      const exchange = mainExchange(group);
      const bySymbol = portfolio.stocks.filter((s) => s.symbol === symbol.toUpperCase());
      const stock =
        portfolio.stocks.find((s) => !!s.isin && isins.includes(s.isin)) ??
        bySymbol.find((s) => s.exchange === exchange) ??
        (bySymbol.length === 1 ? bySymbol[0] : undefined);
      const existing = stock ? portfolio.trades.filter((t) => t.stockId === stock.id) : [];
      const { fresh, already, leftover } = splitKnown(
        group,
        existing.filter((t) => t.kind === 'buy' || t.kind === 'sell'),
        (t) => stockKey({ ...t, price: Math.round(t.price * 100) }),
        stockKey,
      );
      const known: KnownTrade[] = leftover.map((t) => ({
        date: t.date,
        kind: t.kind,
        quantity: t.quantity ?? 0,
        price: (t.price ?? 0) / 100,
      }));
      const asTrades = (list: TradebookTrade[]) => list.map((t, i) => asTrade(t, 'new', `n${i}`));
      const skip = firstConsistent(fresh, (kept) =>
        keepsSharesCovered([...existing, ...asTrades(kept)]),
      );
      const before = replayStock(existing);
      const after = replayStock([...existing, ...asTrades(fresh.slice(skip))]);
      plans.push({
        key,
        segment,
        isin,
        isins,
        name: stock?.name ?? symbol,
        symbol: stock?.symbol ?? symbol,
        exchange: stock?.exchange ?? exchange,
        existingId: stock?.id ?? null,
        add: withIds(
          key,
          fresh.slice(skip).map(planned),
          known,
          (price) =>
            `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ),
        already,
        leftOut: withIds(key, fresh.slice(0, skip).map(planned), [], String),
        before: { held: before.quantity, invested: before.invested },
        after: { held: after.quantity, invested: after.invested, realised: after.realised },
      });
    }
  }
  return plans.sort(
    (a, b) => a.segment.localeCompare(b.segment) * -1 || a.name.localeCompare(b.name),
  );
}
