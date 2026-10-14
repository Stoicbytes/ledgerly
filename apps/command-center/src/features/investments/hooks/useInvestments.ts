import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { todayIso } from '@/lib/domain/expenses';
import {
  allFundRows,
  allStockRows,
  allocation,
  shownFundRows,
  shownStockRows,
  fundTotals,
  fundValueSeries,
  monthlySipTotal,
  pendingSipInstalments,
  stockTotals,
  stockValueSeries,
  upcomingSips,
  type Portfolio,
} from '@/lib/domain/investments';
import { useMarketStore } from '../state/marketStore';
import { usePortfolioStore } from '../state/portfolioStore';

/** The portfolio arrays (stable while nothing changes). */
function usePortfolio(): Portfolio {
  return usePortfolioStore(
    useShallow((state) => ({
      funds: state.funds,
      fundTxns: state.fundTxns,
      sips: state.sips,
      stocks: state.stocks,
      trades: state.trades,
    })),
  );
}

/** Everything the Mutual funds screen shows, computed from the store and prices. */
export function useFundsView(range: number | 'all' = 12) {
  const portfolio = usePortfolio();
  const market = useMarketStore((state) => state.market);
  const today = todayIso();
  return useMemo(() => {
    // Archived, sold funds stay in the totals (realised gains, XIRR) but not in the list.
    const all = allFundRows(portfolio, market, today);
    const rows = shownFundRows(all);
    const active = portfolio.sips.filter((sip) => rows.some((row) => row.fund.id === sip.fundId));
    return {
      rows,
      totals: fundTotals(all, today),
      allocation: allocation(
        rows.map((row) => ({ label: row.assetClass, value: row.position.value })),
      ),
      series: fundValueSeries(portfolio, market, today, range),
      monthlySip: monthlySipTotal(active, today),
      activeSips: active.filter((sip) => sip.active).length,
      upcoming: upcomingSips(active, today),
      pending: pendingSipInstalments(active, portfolio.fundTxns, today),
      market,
      today,
    };
  }, [portfolio, market, today, range]);
}

/** Everything the Stocks screen shows. */
export function useStocksView(range: number | 'all' = 12) {
  const portfolio = usePortfolio();
  const market = useMarketStore((state) => state.market);
  const today = todayIso();
  return useMemo(() => {
    const all = allStockRows(portfolio, market, today);
    const rows = shownStockRows(all);
    const held = rows.filter((row) => row.position.quantity > 0);
    return {
      rows,
      totals: stockTotals(all, today),
      sectors: allocation(
        held.map((row) => ({ label: row.stock.sector || 'Other', value: row.position.value })),
      ),
      series: stockValueSeries(portfolio, market, today, range),
      movers: [...held]
        .filter((row) => row.quote?.source === 'exchange' && row.quote.previous)
        .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))
        .slice(0, 5),
      market,
      today,
    };
  }, [portfolio, market, today, range]);
}
