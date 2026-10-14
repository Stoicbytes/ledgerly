import { fund } from '../__fixtures__';
import { gainType } from '../capitalGains';

const lot = (buyDate: string, sellDate: string) => ({
  buyDate,
  sellDate,
  units4: 1,
  cost: 1,
  proceeds: 2,
  days: 0,
});
const goldFof = fund({
  id: 'g1',
  name: 'Horizon Gold Savings Fund - Direct - Growth',
  category: 'Other Scheme - FoF Domestic',
});
const goldEtf = fund({ id: 'g2', name: 'Horizon Gold ETF', category: 'Other Scheme - Gold ETF' });
const debt = fund({ id: 'd1', category: 'Debt Scheme - Short Duration Fund' });

describe('gold and silver fund gains (Finance Act 2025)', () => {
  it('keeps the slab rate for gold bought from April 2023 and sold before April 2025', () => {
    expect(gainType(goldFof, lot('2023-06-01', '2025-03-15'))).toBe('slab');
    expect(gainType(goldEtf, lot('2023-06-01', '2025-03-15'))).toBe('slab');
  });

  it('from 1 April 2025 sales: long term after 24 months, or 12 for a listed ETF', () => {
    expect(gainType(goldFof, lot('2023-06-01', '2025-07-01'))).toBe('goldLong');
    expect(gainType(goldFof, lot('2024-06-01', '2025-08-01'))).toBe('goldCheck');
    expect(gainType(goldFof, lot('2025-01-01', '2025-11-01'))).toBe('goldShort');
    expect(gainType(goldEtf, lot('2024-06-01', '2025-08-01'))).toBe('goldLong');
    expect(gainType(goldEtf, lot('2025-01-01', '2025-11-01'))).toBe('goldShort');
  });

  it('older gold: 36 months before 23 July 2024, then 24 (12 if listed)', () => {
    expect(gainType(goldFof, lot('2022-01-01', '2024-06-01'))).toBe('goldShort');
    expect(gainType(goldFof, lot('2022-01-01', '2024-08-01'))).toBe('goldLong');
    expect(gainType(goldEtf, lot('2023-01-01', '2024-08-01'))).toBe('goldLong');
  });

  it('debt funds bought from April 2023 stay at the slab rate', () => {
    expect(gainType(debt, lot('2023-06-01', '2026-08-01'))).toBe('slab');
  });
});
