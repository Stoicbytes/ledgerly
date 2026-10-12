import { keepsUnitsCovered } from './forms';
import { replayFund } from './funds';
import type { HoldingPlan, PlannedTrade } from './importPlan';
import { asFundTxn, asTrade } from './importRows';
import { fromUnits4 } from './math';
import { replayStock } from './stocks';
import type { TradebookTrade } from './tradebook';
import { keepsSharesCovered } from './tradeForms';
import type { Portfolio } from './types';

/** The trades the review starts with ticked: everything not flagged as a possible duplicate. */
export const defaultSelection = (plans: HoldingPlan[]) =>
  new Set(plans.flatMap((plan) => plan.add.filter((t) => !t.duplicate).map((t) => t.id)));

/** The plans with only the ticked trades left to add. */
export const selectTrades = (plans: HoldingPlan[], selected: ReadonlySet<string>) =>
  plans.map((plan) => ({ ...plan, add: plan.add.filter((trade) => selected.has(trade.id)) }));

const asTradebook = (plan: HoldingPlan, trade: PlannedTrade): TradebookTrade => ({
  ...trade,
  segment: plan.segment,
  isin: plan.isin,
  symbol: plan.symbol,
  exchange: null,
  tradeId: null,
});

/**
 * What a holding would hold with only the ticked trades, and whether every sale is still
 * covered (unticking a buy can leave a later sale with nothing to sell).
 */
export function selectionCheck(
  plan: HoldingPlan,
  portfolio: Portfolio,
): { held: number; invested: number; covered: boolean } {
  const trades = plan.add.map((trade) => asTradebook(plan, trade));
  if (plan.segment === 'funds') {
    const existing = portfolio.fundTxns.filter((t) => t.fundId === plan.existingId);
    const all = [...existing, ...trades.map((t, i) => asFundTxn(t, 'new', `n${i}`))];
    const after = replayFund(all);
    return {
      held: fromUnits4(after.units4),
      invested: after.invested,
      covered: keepsUnitsCovered(all),
    };
  }
  const existing = portfolio.trades.filter((t) => t.stockId === plan.existingId);
  const all = [...existing, ...trades.map((t, i) => asTrade(t, 'new', `n${i}`))];
  const after = replayStock(all);
  return { held: after.quantity, invested: after.invested, covered: keepsSharesCovered(all) };
}
