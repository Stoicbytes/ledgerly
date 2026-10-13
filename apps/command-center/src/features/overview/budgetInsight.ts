import type { BudgetAlert } from '@/lib/domain/expenses';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import type { Insight } from './insights';

const pct = (alert: BudgetAlert) => `${Math.round((alert.spent / alert.budget) * 100)}%`;

/** One alert's line: "Food is ₹1,200 over its ₹6,000 budget". */
export function alertText(alert: BudgetAlert): string {
  const name = alert.category.name;
  if (alert.level === 'over') {
    return `${name} is ${money(alert.spent - alert.budget)} over its ${money(alert.budget)} budget`;
  }
  if (alert.level === 'near') {
    const used = alert.spent >= alert.budget ? 'all' : pct(alert);
    return `${name} has used ${used} of its ${money(alert.budget)} budget`;
  }
  return `${name} is on course for ${money(alert.projected)} against a ${money(alert.budget)} budget`;
}

/** The Overview insight for budget alerts (null when every budget is fine). */
export function budgetInsight(alerts: BudgetAlert[]): Insight | null {
  if (!alerts.length) return null;
  if (alerts.length === 1) {
    return {
      id: 'budget',
      tone: 'warn',
      title: alertText(alerts[0]),
      detail: 'See Expenses → Budget.',
    };
  }
  const over = alerts.filter((alert) => alert.level === 'over').length;
  const parts = [
    over ? `${over} over` : '',
    alerts.length - over ? `${alerts.length - over} close to the limit` : '',
  ].filter(Boolean);
  return {
    id: 'budget',
    tone: 'warn',
    title: `${alerts.length} budgets need a look: ${parts.join(', ')}`,
    detail: `${alerts.map((alert) => alert.category.name).join(', ')}. See Expenses → Budget.`,
  };
}
