import { useMemo, useState } from 'react';
import { useLedger } from '@/features/expenses/hooks/useLedger';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import { todayIso } from '@/lib/domain/expenses';
import { buildReport, reportPeriod, shiftPeriod, type PeriodKind } from '@/lib/domain/reports';

/** The report for the chosen period, recomputed as the data changes. */
export function useReport() {
  const { transactions, categories } = useLedger();
  const fundTxns = usePortfolioStore((state) => state.fundTxns);
  const trades = usePortfolioStore((state) => state.trades);
  const payslips = useSalaryStore((state) => state.payslips);
  const pfEntries = useSalaryStore((state) => state.pfEntries);
  const today = todayIso();
  const [kind, setKind] = useState<PeriodKind>('month');
  const [offset, setOffset] = useState(0);
  const period = useMemo(
    () => shiftPeriod(reportPeriod(kind, today), offset),
    [kind, offset, today],
  );
  const report = useMemo(
    () =>
      buildReport(
        { transactions, categories, fundTxns, trades, payslips, pfEntries },
        period,
        today,
      ),
    [transactions, categories, fundTxns, trades, payslips, pfEntries, period, today],
  );
  return {
    report,
    kind,
    setKind: (next: PeriodKind) => {
      setKind(next);
      setOffset(0);
    },
    previous: () => setOffset((value) => value - 1),
    next: () => setOffset((value) => Math.min(0, value + 1)),
    isLatest: offset === 0,
    today,
  };
}
