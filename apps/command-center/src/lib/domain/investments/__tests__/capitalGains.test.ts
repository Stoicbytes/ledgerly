import { buy, fund, sell } from '../__fixtures__';
import {
  equityLtcgExemption,
  financialYear,
  gainLines,
  gainSummary,
  gainType,
  gainYears,
  grandfathered,
} from '../capitalGains';

const lot = (buyDate: string, sellDate: string) => ({
  buyDate,
  sellDate,
  units4: 1,
  cost: 1,
  proceeds: 2,
  days: 0,
});
const equity = fund();
const debt = fund({ id: 'f2', category: 'Debt Scheme - Liquid Fund' });
const hybrid = fund({ id: 'f3', category: 'Hybrid Scheme - Balanced Advantage' });

describe('capital gains', () => {
  it('names the Indian financial year', () => {
    expect(financialYear('2026-03-31')).toBe('FY 2025-26');
    expect(financialYear('2026-04-01')).toBe('FY 2026-27');
    expect(financialYear('1999-12-01')).toBe('FY 1999-00');
  });

  it('classifies equity by more than 12 months held', () => {
    expect(gainType(equity, lot('2025-01-10', '2026-01-10'))).toBe('equityShort');
    expect(gainType(equity, lot('2025-01-10', '2026-01-11'))).toBe('equityLong');
  });

  it('taxes newer debt at the slab and older debt by 24 or 36 months', () => {
    expect(gainType(debt, lot('2023-04-01', '2026-10-01'))).toBe('slab');
    expect(gainType(debt, lot('2022-01-01', '2024-06-01'))).toBe('debtShort');
    expect(gainType(debt, lot('2022-01-01', '2024-08-01'))).toBe('debtLong');
    expect(gainType(debt, lot('2023-01-01', '2024-08-01'))).toBe('debtShort');
    expect(gainType(hybrid, lot('2020-01-01', '2026-01-01'))).toBe('check');
  });

  it('splits each sale over the lots it used, per financial year', () => {
    const txns = [
      buy('2024-01-05', 100_000, 100, 10),
      buy('2025-06-05', 120_000, 100, 12),
      sell('2025-08-01', 210_000, 150, 14),
      sell('2026-05-01', 75_000, 50, 15),
    ];
    const lines = gainLines([equity], txns);
    expect(gainYears(lines)).toEqual(['FY 2026-27', 'FY 2025-26']);
    expect(lines.map((line) => [line.fy, line.type, line.gain])).toEqual([
      ['FY 2026-27', 'equityShort', 75_000 - 60_000],
      ['FY 2025-26', 'equityLong', 140_000 - 100_000],
      ['FY 2025-26', 'equityShort', 70_000 - 60_000],
    ]);
    expect(gainSummary(lines, 'FY 2025-26')).toEqual([
      { type: 'equityShort', proceeds: 70_000, cost: 60_000, gain: 10_000, count: 1 },
      { type: 'equityLong', proceeds: 140_000, cost: 100_000, gain: 40_000, count: 1 },
    ]);
  });

  it('knows the yearly exemption and flags units bought before February 2018', () => {
    expect(equityLtcgExemption('FY 2025-26')).toBe(12_500_000);
    expect(equityLtcgExemption('FY 2023-24')).toBe(10_000_000);
    const [line] = gainLines(
      [equity],
      [buy('2017-05-05', 100, 10, 10), sell('2020-05-05', 200, 10, 20)],
    );
    expect(grandfathered(line)).toBe(true);
  });
});
