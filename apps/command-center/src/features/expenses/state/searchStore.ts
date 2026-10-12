import { create } from 'zustand';
import { EMPTY_SEARCH, type SearchFilters } from '@/lib/domain/expenses';

type SearchState = {
  open: boolean;
  filters: SearchFilters;
  /** Chosen period chip (sets `from` / `to`). */
  period: SearchPeriod;
  show: () => void;
  hide: () => void;
  update: (patch: Partial<SearchFilters>) => void;
  setPeriod: (period: SearchPeriod, range: { from: string | null; to: string | null }) => void;
  clear: () => void;
};

export type SearchPeriod = 'any' | 'month' | 'three' | 'year' | 'lastYear';

/** The transaction search: kept while the sheet is closed, so reopening shows the same results. */
export const useSearchStore = create<SearchState>((set) => ({
  open: false,
  filters: EMPTY_SEARCH,
  period: 'any',
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  update: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  setPeriod: (period, range) =>
    set((state) => ({ period, filters: { ...state.filters, ...range } })),
  clear: () => set({ filters: EMPTY_SEARCH, period: 'any' }),
}));
