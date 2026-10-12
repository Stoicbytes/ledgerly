import { useMemo } from 'react';
import {
  addMonths,
  categoryBreakdown,
  categoryTrend,
  limitSlices,
  monthBounds,
  monthLabel,
  monthOf,
  periodTotals,
  subcategoryBreakdown,
  todayIso,
  transactionsInCategory,
  yearBounds,
  yearOfMonth,
} from '@/lib/domain/expenses';
import { useLedger } from '../hooks/useLedger';
import { useExpenseUi } from '../state/expenseUi';

/** Most slices a pie shows; the rest fold into "Other". */
const PIE_SLICES = 10;
/** Months in a category's trend: the selected month in the middle, as in Money Manager. */
const TREND_MONTHS = 7;

/** Last month of the trend: three after the selected one, but never past this month. */
function trendEnd(month: string): string {
  const ahead = addMonths(month, Math.floor(TREND_MONTHS / 2));
  const current = monthOf(todayIso());
  return ahead > current ? (month > current ? month : current) : ahead;
}

/** Stats for the selected kind (income or expenses), period and account, plus the drill-down. */
export function useStatsView() {
  const { transactions, categories } = useLedger();
  const month = useExpenseUi((state) => state.month);
  const kind = useExpenseUi((state) => state.statsKind);
  const period = useExpenseUi((state) => state.statsPeriod);
  const accountId = useExpenseUi((state) => state.accountId);
  const drillId = useExpenseUi((state) => state.drillCategoryId);
  const sliceId = useExpenseUi((state) => state.drillSliceId);
  return useMemo(() => {
    const year = yearOfMonth(month);
    const range = period === 'year' ? yearBounds(year) : monthBounds(month);
    const totals = periodTotals(transactions, range, accountId);
    const ranked = categoryBreakdown(transactions, categories, kind, range, accountId);
    const drill =
      categories.find((category) => category.id === drillId && category.kind === kind) ?? null;
    const subSlices = drill
      ? subcategoryBreakdown(transactions, categories, drill.id, range, accountId)
      : [];
    // The focused subcategory, when it still has entries in this period.
    const focus = subSlices.find((slice) => slice.id === sliceId) ?? null;
    const scope = focus?.id ?? null;
    return {
      kind,
      period,
      month,
      range,
      totals,
      total: kind === 'income' ? totals.income : totals.expense,
      periodLabel: period === 'year' ? String(year) : monthLabel(month),
      ranked,
      pie: limitSlices(ranked, PIE_SLICES),
      drill,
      drillTotal: drill ? (ranked.find((slice) => slice.id === drill.id)?.amount ?? 0) : 0,
      subSlices,
      focus,
      entries: drill
        ? transactionsInCategory(transactions, categories, drill.id, range, accountId, scope)
        : [],
      trend: drill
        ? categoryTrend(
            transactions,
            categories,
            drill.id,
            period === 'year' ? `${year}-12` : trendEnd(month),
            period === 'year' ? 12 : TREND_MONTHS,
            accountId,
            scope,
          )
        : [],
    };
  }, [transactions, categories, month, kind, period, accountId, drillId, sliceId]);
}

export type StatsView = ReturnType<typeof useStatsView>;
