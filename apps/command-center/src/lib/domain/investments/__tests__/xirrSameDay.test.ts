import { annualisedReturn, xirr } from '../math';

describe('xirr without a time span', () => {
  it('has no annualised figure for flows all on one day', () => {
    expect(
      xirr([
        { date: '2025-01-05', amount: -100_00 },
        { date: '2025-01-05', amount: 100_00 },
      ]),
    ).toBeNull();
    expect(
      annualisedReturn(
        [
          { date: '2025-01-05', amount: -100_00 },
          { date: '2025-01-05', amount: 100_00 },
        ],
        '2026-10-08',
      ),
    ).toBeNull();
  });
});
