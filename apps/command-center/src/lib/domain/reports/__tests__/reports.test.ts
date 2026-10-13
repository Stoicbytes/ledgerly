import type { FundTxn, Trade } from '../../investments';
import { categories, transactions } from '../../expenses/__fixtures__/ledger';
import type { PfEntry } from '../../salary';
import {
  buildReport,
  changeText,
  comparisonPeriod,
  reportPdf,
  reportPeriod,
  reportSections,
  shiftPeriod,
} from '..';

const latin1 = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

const fund = (kind: FundTxn['kind'], date: string, amount: number): FundTxn => ({
  id: `${kind}-${date}`,
  fundId: 'f1',
  kind,
  date,
  amount,
  stampDuty: 0,
  units: kind === 'dividend' ? null : 1,
  nav: kind === 'dividend' ? null : 1,
  sipId: null,
  note: '',
  createdAt: 0,
});

const trade = (kind: Trade['kind'], date: string, quantity: number, price: number): Trade => ({
  id: `${kind}-${date}`,
  stockId: 's1',
  kind,
  date,
  quantity,
  price,
  charges: 100,
  amount: null,
  ratioFrom: null,
  ratioTo: null,
  note: '',
  createdAt: 0,
});

const input = {
  transactions,
  categories,
  fundTxns: [fund('buy', '2026-10-05', 500_000), fund('buy', '2026-09-05', 900_000)],
  trades: [trade('buy', '2026-10-07', 10, 20_000), trade('sell', '2026-10-20', 5, 30_000)],
  payslips: [],
  pfEntries: [] as PfEntry[],
};

describe('report periods', () => {
  it('covers a month, a calendar year and an April–March financial year', () => {
    expect(reportPeriod('month', '2026-02-14')).toMatchObject({
      start: '2026-02-01',
      end: '2026-02-28',
      months: ['2026-02'],
    });
    const year = reportPeriod('year', '2026-10-13');
    expect([year.start, year.end, year.label, year.months.length]).toEqual([
      '2026-01-01',
      '2026-12-31',
      '2026',
      12,
    ]);
    const fy = reportPeriod('fy', '2026-02-14');
    expect([fy.start, fy.end, fy.label]).toEqual(['2025-04-01', '2026-03-31', 'FY 2025-26']);
    expect(reportPeriod('fy', '2026-04-01').label).toBe('FY 2026-27');
  });

  it('steps back and forward by whole periods', () => {
    expect(shiftPeriod(reportPeriod('month', '2026-01-10'), -1).start).toBe('2025-12-01');
    expect(shiftPeriod(reportPeriod('fy', '2026-10-13'), 1).label).toBe('FY 2027-28');
  });

  it('compares a period in progress with the same days of the one before', () => {
    const month = reportPeriod('month', '2026-10-13');
    expect(comparisonPeriod(month, '2026-10-13')).toMatchObject({
      start: '2026-09-01',
      end: '2026-09-13',
    });
    expect(comparisonPeriod(month, '2026-11-02').end).toBe('2026-09-30');
    const march = reportPeriod('month', '2026-03-31');
    expect(comparisonPeriod(march, '2026-03-30').end).toBe('2026-02-28');
    expect(comparisonPeriod(reportPeriod('fy', '2026-10-13'), '2026-10-13')).toMatchObject({
      start: '2025-04-01',
      end: '2025-10-13',
    });
  });
});

describe('building a report', () => {
  const report = buildReport(input, reportPeriod('month', '2026-10-13'));

  it('totals income and spending the same way as the rest of the app', () => {
    expect([report.income, report.expense, report.net]).toEqual([8_000_000, 1_046_000, 6_954_000]);
    expect(report.savingsRate).toBeCloseTo((6_954_000 / 8_000_000) * 100);
    expect(report.spending.length).toBeGreaterThan(0);
    expect(report.spending.reduce((sum, line) => sum + line.share, 0)).toBeCloseTo(1);
    expect(report.months).toEqual([]);
  });

  it('counts only the period’s investments, with charges', () => {
    expect(report.investments).toEqual({
      fundsBought: 500_000,
      fundsSold: 0,
      sharesBought: 200_100,
      sharesSold: 149_900,
      dividends: 0,
      netInvested: 550_200,
    });
  });

  it('leaves salary and PF out when there are none', () => {
    expect(report.salary).toBeNull();
    expect(report.pf).toBeNull();
    expect(reportSections(report).map((section) => section.title)).not.toContain('PF / EPF');
  });

  it('lists every month of a year', () => {
    const year = buildReport(input, reportPeriod('year', '2026-10-13'));
    expect(year.months).toHaveLength(12);
    expect(year.months[9]).toMatchObject({ month: '2026-10', income: 8_000_000 });
  });

  it('has no savings rate or change without figures to compare', () => {
    const empty = buildReport(input, reportPeriod('month', '2020-01-01'));
    expect(empty.savingsRate).toBeNull();
    expect(changeText(null)).toBe('');
    expect(changeText(12.4)).toBe('+12%');
    expect(changeText(-8)).toBe('−8%');
  });
});

describe('the PDF', () => {
  it('writes real text and a correct cross-reference table', () => {
    const report = buildReport(input, reportPeriod('month', '2026-10-13'));
    const pdf = latin1(reportPdf(report, '2026-10-13'));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('(Income)');
    const xref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    const offsets = pdf.slice(xref).match(/^\d{10} 00000 n/gm) ?? [];
    expect(offsets.length).toBeGreaterThan(3);
    offsets.forEach((entry, index) => {
      expect(pdf.slice(Number(entry.slice(0, 10))).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });
});
