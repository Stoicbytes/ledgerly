import { create } from 'zustand';
import { addMonths, monthOf, todayIso, type CategoryKind } from '@/lib/domain/expenses';

export type ExpenseView = 'daily' | 'calendar' | 'monthly';

type ExpenseUiState = {
  /** Selected month (YYYY-MM), shared by every Expenses page. */
  month: string;
  /** null = the default view (calendar). */
  view: ExpenseView | null;
  accountId: string | null;
  /** Selected calendar day; becomes the default date for new entries. */
  selectedDate: string | null;
  statsKind: CategoryKind;
  statsPeriod: 'month' | 'year';
  drillCategoryId: string | null;
  /** Inside a drill: the focused subcategory slice (a subcategory id, or the parent's id for "(general)"). */
  drillSliceId: string | null;
  showSubcategories: boolean;
  setMonth: (month: string) => void;
  shiftMonth: (delta: number) => void;
  goToCurrentMonth: () => void;
  setView: (view: ExpenseView) => void;
  setAccount: (accountId: string | null) => void;
  selectDate: (date: string | null) => void;
  setStatsKind: (kind: CategoryKind) => void;
  setStatsPeriod: (period: 'month' | 'year') => void;
  drillInto: (categoryId: string | null) => void;
  /** Focus one subcategory slice; choosing the focused one again clears it. */
  focusSlice: (sliceId: string | null) => void;
  toggleSubcategories: () => void;
};

export const useExpenseUi = create<ExpenseUiState>((set) => ({
  month: monthOf(todayIso()),
  view: null,
  accountId: null,
  selectedDate: null,
  statsKind: 'expense',
  statsPeriod: 'month',
  drillCategoryId: null,
  drillSliceId: null,
  showSubcategories: true,
  setMonth: (month) => set({ month, selectedDate: null }),
  shiftMonth: (delta) =>
    set((state) => ({ month: addMonths(state.month, delta), selectedDate: null })),
  goToCurrentMonth: () => set({ month: monthOf(todayIso()), selectedDate: todayIso() }),
  setView: (view) => set({ view }),
  setAccount: (accountId) => set({ accountId }),
  selectDate: (date) =>
    set(date ? { selectedDate: date, month: monthOf(date) } : { selectedDate: null }),
  setStatsKind: (statsKind) => set({ statsKind, drillCategoryId: null, drillSliceId: null }),
  setStatsPeriod: (statsPeriod) => set({ statsPeriod, drillCategoryId: null, drillSliceId: null }),
  drillInto: (drillCategoryId) => set({ drillCategoryId, drillSliceId: null }),
  focusSlice: (sliceId) =>
    set((state) => ({ drillSliceId: sliceId === state.drillSliceId ? null : sliceId })),
  toggleSubcategories: () => set((state) => ({ showSubcategories: !state.showSubcategories })),
}));
