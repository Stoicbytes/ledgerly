/**
 * Broker tradebooks (Zerodha Console: Reports → Tradebook, Equity or Mutual funds, as XLSX
 * or CSV) turned into plain trades. Nothing here touches the portfolio; importPlan.ts
 * compares the trades with it and the owner approves what is added.
 */
type Cell = string | number | boolean | null;

export type TradebookSegment = 'funds' | 'equity';

export type TradebookTrade = {
  segment: TradebookSegment;
  isin: string;
  symbol: string;
  exchange: 'NSE' | 'BSE' | null;
  date: string;
  kind: 'buy' | 'sell';
  /** Units (funds, up to 4 decimals) or shares (whole). */
  quantity: number;
  /** Rupees per unit or share. */
  price: number;
  /** The broker's trade id: the same trade in two files is counted once. */
  tradeId: string | null;
};

export type TradebookRead = { trades: TradebookTrade[]; problems: string[] };

const REQUIRED = ['symbol', 'isin', 'trade date', 'trade type', 'quantity', 'price'] as const;
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

const text = (cell: Cell | undefined) =>
  cell === null || cell === undefined ? '' : String(cell).trim();

/** Excel serial day (1900 system) or "YYYY-MM-DD" / "DD-MM-YYYY" text → ISO date. */
export function tradeDate(cell: Cell | undefined): string | null {
  if (typeof cell === 'number' && cell > 20000 && cell < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(cell) * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  const value = text(cell).slice(0, 10);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(value);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : [];
  if (!y) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const out = date.toISOString().slice(0, 10);
  return out === `${y}-${m}-${d}` ? out : null;
}

const number = (cell: Cell | undefined) => {
  const value = typeof cell === 'number' ? cell : Number(text(cell).replace(/,/g, ''));
  return Number.isFinite(value) ? value : NaN;
};

/** Reads one tradebook (rows of cells from an .xlsx or .csv). `label` names it in problems. */
export function readTradebook(rows: Cell[][], label: string): TradebookRead {
  const problems: string[] = [];
  const headerAt = rows.findIndex((row) => {
    const names = row.map((cell) => text(cell).toLowerCase());
    return REQUIRED.every((name) => names.includes(name));
  });
  if (headerAt < 0) {
    return {
      trades: [],
      problems: [`${label}: not a broker tradebook (no Symbol, ISIN, Trade Date… columns).`],
    };
  }
  const header = rows[headerAt].map((cell) => text(cell).toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const title = rows.slice(0, headerAt).flat().map(text).join(' ').toLowerCase();
  const fileSegment: TradebookSegment | null = title.includes('mutual fund')
    ? 'funds'
    : title.includes('equity')
      ? 'equity'
      : null;
  const trades: TradebookTrade[] = [];
  rows.slice(headerAt + 1).forEach((row, index) => {
    const at = `${label}, row ${headerAt + index + 2}`;
    if (!text(row[col('symbol')]) && !text(row[col('isin')])) return;
    const segmentCell = text(row[col('segment')]).toUpperCase();
    const segment: TradebookSegment | null =
      segmentCell === 'MF' ? 'funds' : segmentCell === 'EQ' ? 'equity' : fileSegment;
    const isin = text(row[col('isin')]).toUpperCase();
    const date = tradeDate(row[col('trade date')]);
    const kind = text(row[col('trade type')]).toLowerCase();
    const quantity = number(row[col('quantity')]);
    const price = number(row[col('price')]);
    const exchange = text(row[col('exchange')]).toUpperCase();
    if (!segment) return void problems.push(`${at}: not marked as equity or mutual fund.`);
    if (!ISIN.test(isin)) return void problems.push(`${at}: no valid ISIN.`);
    if (!date) return void problems.push(`${at}: the trade date is not a date.`);
    if (kind !== 'buy' && kind !== 'sell')
      return void problems.push(`${at}: "${kind}" is not buy or sell.`);
    if (!(quantity > 0) || (segment === 'equity' && !Number.isInteger(quantity))) {
      return void problems.push(`${at}: the quantity is not valid.`);
    }
    if (!(price > 0)) return void problems.push(`${at}: the price is not valid.`);
    trades.push({
      segment,
      isin,
      symbol: text(row[col('symbol')]),
      exchange: exchange === 'NSE' || exchange === 'BSE' ? exchange : null,
      date,
      kind,
      quantity: segment === 'funds' ? Math.round(quantity * 10000) / 10000 : quantity,
      price: Math.round(price * 10000) / 10000,
      tradeId: text(row[col('trade id')]) || null,
    });
  });
  return { trades, problems };
}

/** Joins several tradebooks; a trade id seen twice (files whose dates overlap) counts once. */
export function mergeTradebooks(reads: TradebookRead[]): TradebookRead {
  const seen = new Set<string>();
  const trades: TradebookTrade[] = [];
  for (const trade of reads.flatMap((read) => read.trades)) {
    const key = trade.tradeId ? `${trade.segment}:${trade.tradeId}` : null;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    trades.push(trade);
  }
  trades.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'buy' ? -1 : 1),
  );
  return { trades, problems: reads.flatMap((read) => read.problems) };
}
