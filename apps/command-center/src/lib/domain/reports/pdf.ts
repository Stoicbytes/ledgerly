import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { assemblePdf } from '@/lib/files/pdf/assemble';
import { Pages, PAGE, WIDTH, widthOf, wrap } from '@/lib/files/pdf/layout';
import { toWinAnsi } from '@/lib/files/pdf/winAnsi';
import type { Report } from './report';

/** "+12%" / "−8%" / "" (no earlier figure to compare). */
export const changeText = (change: number | null) =>
  change === null ? '' : `${change >= 0 ? '+' : '−'}${Math.abs(Math.round(change))}%`;

type Row = { left: string; right: string; bold?: boolean };

/** The report's sections as rows of "label … value", shared by the screen's PDF. */
export function reportSections(report: Report): { title: string; rows: Row[] }[] {
  const sections: { title: string; rows: Row[] }[] = [];
  const vs = (change: number | null) => (change === null ? '' : ` (${changeText(change)})`);
  sections.push({
    title: 'Summary',
    rows: [
      { left: 'Income', right: `${money(report.income)}${vs(report.incomeChange)}` },
      { left: 'Spending', right: `${money(report.expense)}${vs(report.expenseChange)}` },
      { left: 'Saved', right: money(report.net), bold: true },
      {
        left: 'Savings rate',
        right: report.savingsRate === null ? '–' : `${Math.round(report.savingsRate)}%`,
      },
    ],
  });
  const lines = (title: string, items: Report['spending']) => {
    if (!items.length) return;
    sections.push({
      title,
      rows: items.map((item) => ({
        left: `${item.name} (${Math.round(item.share * 100)}%)`,
        right: `${money(item.amount)}${vs(item.change)}`,
      })),
    });
  };
  lines('Spending by category', report.spending);
  lines('Income sources', report.incomeSources);
  const active = report.months.filter((month) => month.income || month.expense);
  if (active.length) {
    sections.push({
      title: 'Month by month',
      rows: active.map((month) => ({
        left: month.label,
        right: `in ${money(month.income)} · out ${money(month.expense)} · saved ${money(month.income - month.expense)}`,
      })),
    });
  }
  const inv = report.investments;
  if (inv.fundsBought || inv.fundsSold || inv.sharesBought || inv.sharesSold || inv.dividends) {
    sections.push({
      title: 'Investments',
      rows: [
        { left: 'Mutual funds bought', right: money(inv.fundsBought) },
        { left: 'Mutual funds sold', right: money(inv.fundsSold) },
        { left: 'Shares bought', right: money(inv.sharesBought) },
        { left: 'Shares sold', right: money(inv.sharesSold) },
        { left: 'Dividends', right: money(inv.dividends) },
        { left: 'Net invested', right: money(inv.netInvested), bold: true },
      ],
    });
  }
  if (report.salary) {
    sections.push({
      title: 'Salary',
      rows: [
        { left: 'Payslips', right: String(report.salary.payslips) },
        { left: 'Gross pay', right: money(report.salary.gross) },
        { left: 'Tax deducted (TDS)', right: money(report.salary.tds) },
        { left: 'Your PF and VPF', right: money(report.salary.pf) },
        { left: 'Net pay', right: money(report.salary.net), bold: true },
      ],
    });
  }
  if (report.pf) {
    sections.push({
      title: 'Provident fund',
      rows: [
        { left: 'Contributions', right: money(report.pf.contributed) },
        { left: 'Interest credited', right: money(report.pf.interest) },
        { left: 'Withdrawn', right: money(report.pf.withdrawn) },
        { left: `Balance on ${report.period.end}`, right: money(report.pf.closing), bold: true },
      ],
    });
  }
  return sections;
}

/** The report as an A4 PDF (real text, standard fonts), made on the device. */
export function reportPdf(report: Report, generatedOn: string): Uint8Array {
  const out = new Pages();
  const left = PAGE.margin;
  out.text(left, [['F2', 18, 'Ledgerly report']], 22);
  out.text(left, [['F1', 11, toWinAnsi(`${report.period.label} · made on ${generatedOn}`)]], 16);
  for (const section of reportSections(report)) {
    out.need(15 + 6 + 30);
    out.space(12);
    out.text(left, [['F2', 11, toWinAnsi(section.title.toUpperCase())]], 15);
    out.rule();
    for (const row of section.rows) {
      const font = row.bold ? 'F2' : 'F1';
      const right = toWinAnsi(row.right);
      const rightWidth = widthOf(right, font, 10);
      const parts = wrap(toWinAnsi(row.left), font, 10, WIDTH - rightWidth - 16);
      parts.forEach((part, index) => {
        out.text(left, [[font, 10, part]], 14);
        if (index === 0) {
          out.space(-14);
          out.text(PAGE.margin + WIDTH - rightWidth, [[font, 10, right]], 14);
        }
      });
    }
  }
  return assemblePdf(out.done(), `Ledgerly report - ${report.period.label}`, 'Ledgerly');
}
