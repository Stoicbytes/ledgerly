import type { Additions, HoldingPlan } from './importPlan';
import { asFundTxn, asTrade } from './importRows';
import type { TradebookTrade } from './tradebook';
import type { Fund, Portfolio, Stock } from './types';

/** Turns the approved holdings of a plan into new rows (and an ISIN for a fund matched by name). */
export function buildAdditions(
  plans: HoldingPlan[],
  approved: ReadonlySet<string>,
  portfolio: Portfolio,
  makeId: () => string,
  now = Date.now(),
): Additions {
  const out: Additions = { funds: [], fundTxns: [], stocks: [], trades: [] };
  let fundOrder = portfolio.funds.reduce((max, f) => Math.max(max, f.order + 1), 0);
  let stockOrder = portfolio.stocks.reduce((max, s) => Math.max(max, s.order + 1), 0);
  for (const plan of plans) {
    if (!approved.has(plan.key) || plan.add.length === 0) continue;
    const trades = plan.add.map((t): TradebookTrade => ({
      ...t,
      segment: plan.segment,
      isin: plan.isin,
      symbol: plan.symbol,
      exchange: null,
      tradeId: null,
    }));
    if (plan.segment === 'funds') {
      const existing = portfolio.funds.find((f) => f.id === plan.existingId);
      const fund: Fund = existing
        ? { ...existing, isin: existing.isin ?? plan.isin }
        : {
            id: makeId(),
            schemeCode: null,
            isin: plan.isin,
            name: plan.name.slice(0, 200),
            category: '',
            fundHouse: '',
            folio: '',
            manualNav: null,
            manualNavDate: null,
            note: '',
            archived: false,
            order: fundOrder++,
            createdAt: now,
          };
      if (!existing || existing.isin !== fund.isin) out.funds.push(fund);
      out.fundTxns.push(
        ...trades.map((t) => ({ ...asFundTxn(t, fund.id, makeId()), createdAt: now })),
      );
    } else {
      const existing = portfolio.stocks.find((s) => s.id === plan.existingId);
      const symbol =
        plan.symbol
          .toUpperCase()
          .replace(/[^A-Z0-9&._-]/g, '')
          .slice(0, 30) || plan.isin;
      // Prices follow the ISIN; when the file shows the share moving to a new ISIN (after a
      // split, say), the stock takes the newer one.
      const newerIsin = !existing?.isin || plan.isins.includes(existing.isin);
      const stock: Stock = existing
        ? { ...existing, isin: newerIsin ? plan.isin : existing.isin }
        : {
            id: makeId(),
            isin: plan.isin,
            symbol,
            exchange: plan.exchange,
            name: plan.name.slice(0, 200),
            sector: '',
            manualPrice: null,
            manualPriceDate: null,
            note: '',
            archived: false,
            order: stockOrder++,
            createdAt: now,
          };
      if (!existing || existing.isin !== stock.isin) out.stocks.push(stock);
      out.trades.push(
        ...trades.map((t) => ({ ...asTrade(t, stock.id, makeId()), createdAt: now })),
      );
    }
  }
  return out;
}
