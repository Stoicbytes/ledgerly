import { formatAxisMoney, formatMoney, formatMoneyWhole } from '../currency';

describe('rounding to whole rupees', () => {
  it('rounds half away from zero on both sides', () => {
    expect(formatMoneyWhole(150)).toBe('₹2');
    expect(formatMoneyWhole(-150)).toBe('−₹2');
    expect(formatMoneyWhole(-250)).toBe('−₹3');
    expect(formatMoneyWhole(149)).toBe('₹1');
    expect(formatMoneyWhole(-149)).toBe('−₹1');
  });

  it('never prints a minus zero', () => {
    expect(formatMoneyWhole(-49)).toBe('₹0');
    expect(formatMoney(-49, { whole: true })).toBe('₹0');
    expect(formatAxisMoney(-49)).toBe('₹0');
    expect(formatMoney(-4, { compact: true })).toBe('₹0');
  });
});

describe('compact Indian units', () => {
  it.each([
    [99_999_99, '₹1L'],
    [99_950_00, '₹1L'],
    [94_400_00, '₹94K'],
    [999_60, '₹1K'],
    [99_99_999_99, '₹1Cr'],
    [9_99_50_000_00, '₹10Cr'],
    [-99_999_99, '−₹1L'],
  ])('%d paise → %s', (minor, label) => {
    expect(formatAxisMoney(minor)).toBe(label);
  });

  it('uses the same L and Cr style for compact money', () => {
    expect(formatMoney(150_000_00, { compact: true })).toBe('₹1.5L');
    expect(formatMoney(99_999_99, { compact: true })).toBe('₹1L');
    expect(formatMoney(-2_50_00_000_00, { compact: true, signDisplay: 'always' })).toBe('−₹2.5Cr');
  });
});
