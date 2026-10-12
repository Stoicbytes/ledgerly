import { useCallback, useState } from 'react';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import {
  buildAdditions,
  defaultSelection,
  mergeTradebooks,
  planImport,
  selectionCheck,
  selectTrades,
  type HoldingPlan,
} from '@/lib/domain/investments';
import { newId } from '@/lib/ids';
import { pickFiles } from './pickFiles';
import { readTradebookFile } from './readFile';

export type ImportPhase = 'choose' | 'reading' | 'review';

const portfolioNow = () => {
  const { funds, fundTxns, sips, stocks, trades } = usePortfolioStore.getState();
  return { funds, fundTxns, sips, stocks, trades };
};

/**
 * Choose tradebooks → review what would change → approve. Nothing reaches the portfolio
 * (or the cloud) until `approve`, and then only the trades left ticked. Possible
 * duplicates start unticked.
 */
export function useTradebookImport() {
  const [phase, setPhase] = useState<ImportPhase>('choose');
  const [files, setFiles] = useState<string[]>([]);
  const [plans, setPlans] = useState<HoldingPlan[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const choose = useCallback(async () => {
    const picked = await pickFiles();
    if (!picked?.length) return;
    setPhase('reading');
    const merged = mergeTradebooks(await Promise.all(picked.map(readTradebookFile)));
    const next = planImport(merged.trades, portfolioNow());
    setFiles(picked.map((file) => file.name));
    setPlans(next);
    setProblems(merged.problems);
    setSelected(defaultSelection(next));
    setPhase('review');
  }, []);

  /** Ticks or unticks trades: one, or a whole holding's. */
  const toggle = useCallback((ids: string[], on: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPhase('choose');
    setFiles([]);
    setPlans([]);
    setProblems([]);
    setSelected(new Set());
  }, []);

  const chosen = selectTrades(plans, selected).filter((plan) => plan.add.length);
  const checks = new Map(chosen.map((plan) => [plan.key, selectionCheck(plan, portfolioNow())]));
  const uncovered = chosen.filter((plan) => !checks.get(plan.key)?.covered);

  /** Adds the ticked trades; returns how many trades and holdings were added. */
  const approve = useCallback(() => {
    const keys = new Set(chosen.map((plan) => plan.key));
    const additions = buildAdditions(chosen, keys, portfolioNow(), newId);
    usePortfolioStore.getState().importPortfolio(additions);
    return { trades: additions.fundTxns.length + additions.trades.length, holdings: keys.size };
  }, [chosen]);

  return {
    phase,
    files,
    plans,
    problems,
    selected,
    /** Per holding with ticked trades: what it would hold, and whether every sale is covered. */
    checks,
    uncovered,
    tradeCount: chosen.reduce((sum, plan) => sum + plan.add.length, 0),
    choose,
    toggle,
    reset,
    approve,
  };
}
