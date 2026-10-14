import { buy, fund, sell } from '../__fixtures__';
import { elssLocked } from '../lockIn';
import { replayFund } from '../funds';

describe('ELSS lock-in', () => {
  const elss = fund({ category: 'Equity Scheme - ELSS' });
  const txns = [
    buy('2023-01-10', 10_000_00, 100, 100),
    buy('2024-06-10', 10_000_00, 80, 125),
    buy('2025-03-10', 10_000_00, 50, 200),
    sell('2026-02-01', 15_000_00, 120, 125),
  ];

  it('counts units still within 3 years of their purchase', () => {
    const lots = replayFund(txns).lots;
    // The 2023 units are free; 60 of the June 2024 units and all 50 of March 2025 are locked
    expect(elssLocked(elss, lots, '2026-10-14')).toEqual({ units4: 110_0000, until: '2028-03-10' });
    expect(elssLocked(elss, lots, '2028-03-10')).toBeNull();
    expect(elssLocked(fund(), lots, '2026-10-14')).toBeNull();
  });
});
