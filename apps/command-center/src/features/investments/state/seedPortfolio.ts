import { seeded } from '@/features/preview/random';
import { addDays, addMonths, monthOf, todayIso } from '@/lib/domain/expenses';
import {
  EMPTY_MARKET,
  suggestStampDuty,
  unitsFor,
  type FundTxn,
  type MarketData,
  type Portfolio,
  type Series,
} from '@/lib/domain/investments';

/**
 * PREVIEW SAMPLE (see features/preview/notice.ts): a made-up portfolio and made-up prices
 * for the design preview, used only when the app is not signed in. Fund and company
 * names, scheme codes and ISINs are fictional; nothing here is market data.
 */

// id | name | AMFI-style category | fund house | code | first NAV | last NAV | SIP ₹ | SIP day
const FUNDS = `
pf1|Horizon Bluechip Fund - Direct Plan - Growth|Equity Scheme - Large Cap Fund|Horizon Mutual Fund|990001|61.2|73.84|5000|5
pf2|Meridian Flexi Cap Fund - Direct Plan - Growth|Equity Scheme - Flexi Cap Fund|Meridian Mutual Fund|990002|118.4|139.62|4000|10
pf3|Summit Midcap Opportunities - Direct Plan - Growth|Equity Scheme - Mid Cap Fund|Summit Mutual Fund|990003|92.3|117.15|3000|15
pf4|Orbit Nifty 50 Index Fund - Direct Plan - Growth|Other Scheme - Index Funds|Orbit Mutual Fund|990004|24.1|27.66|2000|20
pf5|Harbor Short Duration Fund - Direct Plan - Growth|Debt Scheme - Short Duration Fund|Harbor Mutual Fund|990005|31.5|33.72|0|0`;

// id | symbol | name | sector | first ₹ | last ₹ | buys as quantity@price, …
const STOCKS = `
ps1|AURA|Aurora Technologies|Technology|1480|1712|40@1480
ps2|BNYN|Banyan Bank|Financials|640|698|60@642,25@655
ps3|CDRP|Cedar Pharma|Healthcare|1120|1034|30@1120
ps4|DLTP|Delta Power Grid|Utilities|286|331|120@286
ps5|EMBR|Ember Motors|Automobile|2340|2615|25@2340
ps6|FRNT|Frontier Foods|Consumer|512|489|60@512`;

const rows = (table: string) =>
  table
    .trim()
    .split('\n')
    .map((line) => line.split('|'));

/** Weekday prices from `from` to `to`, drifting from start to end with seeded noise. */
function path(seed: number, from: string, to: string, start: number, end: number, places: number) {
  const random = seeded(seed);
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T12:00:00`).getDay();
    if (weekday !== 0 && weekday !== 6) days.push(day);
  }
  const factor = 10 ** places;
  let noise = 0;
  return days.map((day, index): [string, number] => {
    noise = noise * 0.9 + (random() - 0.5) * 0.02;
    const trend = start + ((end - start) * index) / Math.max(1, days.length - 1);
    const value = index === days.length - 1 ? end : trend * (1 + noise);
    return [day, Math.round(value * factor) / factor];
  });
}

const valueOn = (series: Series, date: string) =>
  [...series].reverse().find(([day]) => day <= date)?.[1] ?? series[0][1];

const pad = (day: number) => String(day).padStart(2, '0');

export function seedPortfolio(today = todayIso()): { portfolio: Portfolio; market: MarketData } {
  const from = `${addMonths(monthOf(today), -13)}-01`;
  const lastDay = addDays(today, -1);
  const portfolio: Portfolio = { funds: [], fundTxns: [], sips: [], stocks: [], trades: [] };
  const market: MarketData = {
    ...EMPTY_MARKET,
    schemes: {},
    navHistory: {},
    securities: {},
    priceHistory: {},
  };
  let created = 1;
  rows(FUNDS).forEach(([id, name, category, fundHouse, code, start, end, sip, day], index) => {
    const history = path(index + 11, from, lastDay, Number(start), Number(end), 4);
    const [navDate, nav] = history[history.length - 1];
    market.navHistory[code] = history;
    market.schemes[code] = { name, fundHouse, category, nav, navDate };
    portfolio.funds.push({
      ...{ id, name, category, fundHouse, folio: '', note: '', archived: false },
      ...{ schemeCode: Number(code), isin: null, manualNav: null, manualNavDate: null },
      order: index,
      createdAt: 0,
    });
    const buy = (date: string, amount: number, sipId: string | null): FundTxn => {
      const price = valueOn(history, date);
      const stampDuty = suggestStampDuty(amount);
      const units = unitsFor(amount, stampDuty, price);
      return {
        ...{ id: `pt${created}`, fundId: id, kind: 'buy', date, amount, stampDuty, units },
        ...{ nav: price, sipId, note: '', createdAt: created++ },
      };
    };
    if (!Number(sip)) {
      portfolio.fundTxns.push(buy(addDays(from, 3), 5_000_000, null));
      return;
    }
    const sipId = `pp${index}`;
    const startDate = `${monthOf(from)}-${pad(Number(day))}`;
    portfolio.sips.push({
      ...{ id: sipId, fundId: id, amount: Number(sip) * 100, day: Number(day), startDate },
      ...{ endDate: null, active: true, note: '', createdAt: 0 },
    });
    for (let month = monthOf(from); month < monthOf(today); month = addMonths(month, 1)) {
      portfolio.fundTxns.push(buy(`${month}-${pad(Number(day))}`, Number(sip) * 100, sipId));
    }
  });
  rows(STOCKS).forEach(([id, symbol, name, sector, start, end, buys], index) => {
    const isin = `XXSAMPLE00${index + 1}${index + 1}`;
    const history = path(index + 31, addDays(today, -200), lastDay, +start * 100, +end * 100, 0);
    const [priceDate, close] = history[history.length - 1];
    market.priceHistory[isin] = history;
    const prevClose = history[history.length - 2][1];
    market.securities[isin] = { symbol, name, exchange: 'NSE', close, prevClose, priceDate };
    portfolio.stocks.push({
      ...{ id, isin, symbol, exchange: 'NSE', name, sector, manualPrice: null },
      ...{ manualPriceDate: null, note: '', archived: false, order: index, createdAt: 0 },
    });
    buys.split(',').forEach((entry, buyIndex) => {
      const [quantity, price] = entry.split('@').map(Number);
      portfolio.trades.push({
        ...{ id: `pr${created}`, stockId: id, kind: 'buy', date: history[buyIndex * 40][0] },
        ...{ quantity, price: price * 100, charges: 2000, amount: null, ratioFrom: null },
        ...{ ratioTo: null, note: '', createdAt: created++ },
      });
    });
  });
  return { portfolio, market };
}
