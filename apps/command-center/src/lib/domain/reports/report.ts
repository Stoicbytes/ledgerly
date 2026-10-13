import {
  categoryBreakdown,
  monthLabel,
  percentChange,
  periodTotals,
  type Category,
  type Transaction,
} from '../expenses';
import type { FundTxn, Trade } from '../investments';
import { grossPay, netPay, pfBalance, type Payslip, type PfEntry } from '../salary';
import { comparisonPeriod, type ReportPeriod } from './period';

export type ReportInput = {
  transactions: Transaction[];
  categories: Category[];
  fundTxns: FundTxn[];
  trades: Trade[];
  payslips: Payslip[];
  pfEntries: PfEntry[];
};

export type ReportLine = { name: string; amount: number; share: number; change: number | null };

export type Report = {
  period: ReportPeriod;
  income: number;
  expense: number;
  net: number;
  /** Share of income kept, percent; null without income. */
  savingsRate: number | null;
  incomeChange: number | null;
  expenseChange: number | null;
  spending: ReportLine[];
  incomeSources: ReportLine[];
  /** Month by month (years only). */
  months: { month: string; label: string; income: number; expense: number }[];
  investments: {
    fundsBought: number;
    fundsSold: number;
    sharesBought: number;
    sharesSold: number;
    dividends: number;
    /** Bought minus sold. */
    netInvested: number;
  };
  salary: { payslips: number; gross: number; net: number; tds: number; pf: number } | null;
  pf: { contributed: number; interest: number; withdrawn: number; closing: number } | null;
};

const within = (date: string, period: ReportPeriod) => date >= period.start && date <= period.end;

function lines(
  input: ReportInput,
  kind: 'expense' | 'income',
  period: ReportPeriod,
  before: ReportPeriod,
  limit: number,
): ReportLine[] {
  const previous = new Map(
    categoryBreakdown(input.transactions, input.categories, kind, before).map((slice) => [
      slice.id,
      slice.amount,
    ]),
  );
  return categoryBreakdown(input.transactions, input.categories, kind, period)
    .slice(0, limit)
    .map((slice) => ({
      name: slice.name,
      amount: slice.amount,
      share: slice.share,
      change: percentChange(slice.amount, previous.get(slice.id) ?? 0),
    }));
}

function investments(input: ReportInput, period: ReportPeriod): Report['investments'] {
  const funds = input.fundTxns.filter((txn) => within(txn.date, period));
  const trades = input.trades.filter((trade) => within(trade.date, period));
  const sum = <T>(items: T[], value: (item: T) => number) =>
    items.reduce((total, item) => total + value(item), 0);
  const tradeValue = (trade: Trade) => (trade.quantity ?? 0) * (trade.price ?? 0);
  const fundsBought = sum(
    funds.filter((t) => t.kind === 'buy'),
    (t) => t.amount,
  );
  const fundsSold = sum(
    funds.filter((t) => t.kind === 'sell'),
    (t) => t.amount,
  );
  const sharesBought = sum(
    trades.filter((t) => t.kind === 'buy'),
    (t) => tradeValue(t) + t.charges,
  );
  const sharesSold = sum(
    trades.filter((t) => t.kind === 'sell'),
    (t) => tradeValue(t) - t.charges,
  );
  const dividends =
    sum(
      funds.filter((t) => t.kind === 'dividend'),
      (t) => t.amount,
    ) +
    sum(
      trades.filter((t) => t.kind === 'dividend'),
      (t) => t.amount ?? 0,
    );
  return {
    fundsBought,
    fundsSold,
    sharesBought,
    sharesSold,
    dividends,
    netInvested: fundsBought + sharesBought - fundsSold - sharesSold,
  };
}

/**
 * Everything the Reports screen and its PDF show for one period. With `today` inside the
 * period, changes compare with the same number of days of the period before.
 */
export function buildReport(input: ReportInput, period: ReportPeriod, today?: string): Report {
  const compareWith = comparisonPeriod(period, today);
  const now = periodTotals(input.transactions, period);
  const before = periodTotals(input.transactions, compareWith);
  const slips = input.payslips.filter((slip) => period.months.includes(slip.month));
  const pfIn = input.pfEntries.filter((entry) => within(entry.date, period));
  const pfSum = (kind: PfEntry['kind']) =>
    pfIn
      .filter((entry) => entry.kind === kind)
      .reduce((total, entry) => total + entry.employee + entry.vpf + entry.employer, 0);
  return {
    period,
    income: now.income,
    expense: now.expense,
    net: now.income - now.expense,
    savingsRate: now.income > 0 ? ((now.income - now.expense) / now.income) * 100 : null,
    incomeChange: percentChange(now.income, before.income),
    expenseChange: percentChange(now.expense, before.expense),
    spending: lines(input, 'expense', period, compareWith, 12),
    incomeSources: lines(input, 'income', period, compareWith, 6),
    months:
      period.kind === 'month'
        ? []
        : period.months.map((month) => {
            const totals = periodTotals(input.transactions, {
              start: `${month}-01`,
              end: `${month}-31`,
            });
            return {
              month,
              label: monthLabel(month, 'short'),
              income: totals.income,
              expense: totals.expense,
            };
          }),
    investments: investments(input, period),
    salary: slips.length
      ? {
          payslips: slips.length,
          gross: slips.reduce((total, slip) => total + grossPay(slip), 0),
          net: slips.reduce((total, slip) => total + netPay(slip), 0),
          tds: slips.reduce((total, slip) => total + slip.tds, 0),
          pf: slips.reduce((total, slip) => total + slip.epfEmployee + slip.vpf, 0),
        }
      : null,
    pf: input.pfEntries.length
      ? {
          contributed: pfSum('contribution'),
          interest: pfSum('interest'),
          withdrawn: pfSum('withdrawal'),
          closing: pfBalance(input.pfEntries, period.end).total,
        }
      : null,
  };
}
