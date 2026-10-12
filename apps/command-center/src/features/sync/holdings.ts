import type { Portfolio } from '@/lib/domain/investments';

/**
 * Prices come only for holdings already saved (load_market), so a newly saved fund
 * linked to an AMFI scheme, or a share with an ISIN, needs one more price load.
 */
const holdingKeys = (portfolio: Portfolio) => [
  ...portfolio.funds.flatMap((fund) => (fund.schemeCode ? [`f${fund.schemeCode}`] : [])),
  ...portfolio.stocks.flatMap((stock) => (stock.isin ? [`s${stock.isin}`] : [])),
];
export const addsHoldings = (before: Portfolio, after: Portfolio) => {
  const known = new Set(holdingKeys(before));
  return holdingKeys(after).some((key) => !known.has(key));
};
