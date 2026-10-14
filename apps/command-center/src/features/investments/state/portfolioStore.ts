import { create } from 'zustand';
import {
  EMPTY_PORTFOLIO,
  keepsSharesCovered,
  keepsUnitsCovered,
  type Fund,
  type FundTxn,
  type Portfolio,
  type Sip,
  type Stock,
  type Trade,
  type ValidFundTxn,
  type ValidTrade,
} from '@/lib/domain/investments';
import type { Additions } from '@/lib/domain/investments/tradebookImport';
import { newId } from '@/lib/ids';
import { samples } from '@/features/preview/samples';

const sample = (): Portfolio => samples()?.seedPortfolio().portfolio ?? EMPTY_PORTFOLIO;

/**
 * Mutual funds and stocks. In preview mode it holds the labelled sample; signed in,
 * cloud sync loads the user's own portfolio into it and saves every change (the same
 * pattern as the expense store). Calculations live in src/lib/domain/investments.
 */
export type FundInput = Omit<Fund, 'id' | 'createdAt' | 'order' | 'archived' | 'isin'> & {
  archived?: boolean;
  /** Left out: the fund keeps the ISIN it has. */
  isin?: string | null;
};
export type SipInput = Omit<Sip, 'id' | 'createdAt'>;
export type StockInput = Omit<Stock, 'id' | 'createdAt' | 'order' | 'archived'> & {
  archived?: boolean;
};

type PortfolioStore = Portfolio & {
  saveFund: (input: FundInput, id?: string | null) => Fund;
  /** Removes a fund with its transactions and SIPs; returns the previous portfolio for undo. */
  deleteFund: (id: string) => Portfolio;
  saveFundTxn: (fundId: string, value: ValidFundTxn, id?: string | null) => FundTxn;
  /** Refuses (returns false) when a later redemption would be left without units. */
  deleteFundTxn: (id: string) => boolean;
  saveSip: (input: SipInput, id?: string | null) => Sip;
  deleteSip: (id: string) => void;
  saveStock: (input: StockInput, id?: string | null) => Stock;
  deleteStock: (id: string) => Portfolio;
  saveTrade: (stockId: string, value: ValidTrade, id?: string | null) => Trade;
  deleteTrade: (id: string) => boolean;
  /** Adds approved imported rows in one change (saved as one batch). */
  importPortfolio: (additions: Additions) => void;
  restorePortfolio: (portfolio: Portfolio) => void;
  resetPreview: () => void;
};

const nextOrder = (items: { order: number }[]) =>
  items.reduce((max, item) => Math.max(max, item.order + 1), 0);

const snapshot = (state: Portfolio): Portfolio => ({
  funds: state.funds,
  fundTxns: state.fundTxns,
  sips: state.sips,
  stocks: state.stocks,
  trades: state.trades,
});

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  ...sample(),

  saveFund: (input, id) => {
    const existing = id ? get().funds.find((fund) => fund.id === id) : undefined;
    const fund: Fund = {
      ...input,
      isin: input.isin !== undefined ? input.isin : (existing?.isin ?? null),
      // Left out by a form that does not show them (or before migration 0013): kept.
      expenseRatio:
        input.expenseRatio !== undefined ? input.expenseRatio : (existing?.expenseRatio ?? null),
      goalId: input.goalId !== undefined ? input.goalId : (existing?.goalId ?? null),
      id: existing?.id ?? newId(),
      archived: input.archived ?? existing?.archived ?? false,
      order: existing?.order ?? nextOrder(get().funds),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    set((state) => ({ funds: upsert(state.funds, fund) }));
    return fund;
  },

  deleteFund: (id) => {
    const previous = snapshot(get());
    set((state) => ({
      funds: state.funds.filter((fund) => fund.id !== id),
      fundTxns: state.fundTxns.filter((txn) => txn.fundId !== id),
      sips: state.sips.filter((sip) => sip.fundId !== id),
    }));
    return previous;
  },

  saveFundTxn: (fundId, value, id) => {
    const existing = id ? get().fundTxns.find((txn) => txn.id === id) : undefined;
    const txn: FundTxn = {
      ...value,
      fundId,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    set((state) => ({ fundTxns: upsert(state.fundTxns, txn) }));
    return txn;
  },

  deleteFundTxn: (id) => {
    const txn = get().fundTxns.find((item) => item.id === id);
    if (!txn) return false;
    const rest = get().fundTxns.filter((item) => item.id !== id);
    if (!keepsUnitsCovered(rest.filter((item) => item.fundId === txn.fundId))) return false;
    set({ fundTxns: rest });
    return true;
  },

  saveSip: (input, id) => {
    const existing = id ? get().sips.find((sip) => sip.id === id) : undefined;
    const sip: Sip = {
      ...input,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    set((state) => ({ sips: upsert(state.sips, sip) }));
    return sip;
  },

  deleteSip: (id) =>
    set((state) => ({
      sips: state.sips.filter((sip) => sip.id !== id),
      // Instalments already recorded stay; they just lose the link (as in the database).
      fundTxns: state.fundTxns.map((txn) => (txn.sipId === id ? { ...txn, sipId: null } : txn)),
    })),

  saveStock: (input, id) => {
    const existing = id ? get().stocks.find((stock) => stock.id === id) : undefined;
    const stock: Stock = {
      ...input,
      id: existing?.id ?? newId(),
      archived: input.archived ?? existing?.archived ?? false,
      order: existing?.order ?? nextOrder(get().stocks),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    set((state) => ({ stocks: upsert(state.stocks, stock) }));
    return stock;
  },

  deleteStock: (id) => {
    const previous = snapshot(get());
    set((state) => ({
      stocks: state.stocks.filter((stock) => stock.id !== id),
      trades: state.trades.filter((trade) => trade.stockId !== id),
    }));
    return previous;
  },

  saveTrade: (stockId, value, id) => {
    const existing = id ? get().trades.find((trade) => trade.id === id) : undefined;
    const trade: Trade = {
      ...value,
      stockId,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    set((state) => ({ trades: upsert(state.trades, trade) }));
    return trade;
  },

  deleteTrade: (id) => {
    const trade = get().trades.find((item) => item.id === id);
    if (!trade) return false;
    const rest = get().trades.filter((item) => item.id !== id);
    if (!keepsSharesCovered(rest.filter((item) => item.stockId === trade.stockId))) return false;
    set({ trades: rest });
    return true;
  },

  importPortfolio: (additions) =>
    set((state) => ({
      funds: additions.funds.reduce(upsert, state.funds),
      fundTxns: [...state.fundTxns, ...additions.fundTxns],
      stocks: additions.stocks.reduce(upsert, state.stocks),
      trades: [...state.trades, ...additions.trades],
    })),
  restorePortfolio: (portfolio) => set(portfolio),
  resetPreview: () => set(sample()),
}));

export const getPortfolio = (): Portfolio => snapshot(usePortfolioStore.getState());
