import { toUnits4, unitsValue, xirr } from '../math';

describe('xirr', () => {
  it('is 10 % for +10 % after exactly a year', () => {
    const rate = xirr([
      { date: '2025-01-01', amount: -10000 },
      { date: '2026-01-01', amount: 11000 },
    ]);
    expect(rate).toBeCloseTo(0.1, 8);
  });

  it('matches the spreadsheet XIRR example', () => {
    const rate = xirr([
      { date: '2008-01-01', amount: -10000 },
      { date: '2008-03-01', amount: 2750 },
      { date: '2008-10-30', amount: 4250 },
      { date: '2009-02-15', amount: 3250 },
      { date: '2009-04-01', amount: 2750 },
    ]);
    expect(rate).toBeCloseTo(0.373362535, 6);
  });

  it('handles losses and monthly SIPs', () => {
    expect(
      xirr([
        { date: '2025-01-01', amount: -10000 },
        { date: '2026-01-01', amount: 8000 },
      ]),
    ).toBeCloseTo(-0.2, 8);
    const sip = Array.from({ length: 12 }, (_, month) => ({
      date: `2025-${String(month + 1).padStart(2, '0')}-05`,
      amount: -5000,
    }));
    const rate = xirr([...sip, { date: '2026-01-05', amount: 65000 }]);
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.2);
  });

  it('is null without money both in and out', () => {
    expect(xirr([{ date: '2025-01-01', amount: -100 }])).toBeNull();
    expect(xirr([])).toBeNull();
  });
});

describe('unit maths', () => {
  it('values units exactly in paise', () => {
    expect(toUnits4(86.0246)).toBe(860246);
    expect(unitsValue(860246, 58.12)).toBe(499975);
    expect(unitsValue(toUnits4(1234.567), 1234.5678)).toBe(152415667);
  });
});
