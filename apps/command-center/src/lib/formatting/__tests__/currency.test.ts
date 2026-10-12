import {
  assertMinorUnits,
  formatAxisMoney,
  formatMoney,
  formatMoneyWhole,
  formatPercent,
  moneyAccessibilityLabel,
} from '../currency';

describe('formatMoney', () => {
  it('formats paise as rupees with Indian grouping', () => {
    expect(formatMoney(125050)).toBe('₹1,250.50');
    expect(formatMoney(12_345_678_90)).toBe('₹1,23,45,678.90');
  });

  it('uses a true minus sign for negatives and never shows a sign for zero', () => {
    expect(formatMoney(-500)).toBe('−₹5.00');
    expect(formatMoney(0, { signDisplay: 'always' })).toBe('₹0.00');
  });

  it('supports always/never sign display', () => {
    expect(formatMoney(500, { signDisplay: 'always' })).toBe('+₹5.00');
    expect(formatMoney(-500, { signDisplay: 'never' })).toBe('₹5.00');
  });

  it('supports compact notation for axes and tiles', () => {
    expect(formatMoney(150_000_00, { compact: true })).toMatch(/₹1\.5\s?L/);
  });

  it('rejects non-integer minor units so float rupees cannot leak in', () => {
    expect(() => formatMoney(12.5)).toThrow(RangeError);
    expect(() => assertMinorUnits(Number.NaN)).toThrow(RangeError);
    expect(() => assertMinorUnits(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe('moneyAccessibilityLabel', () => {
  it('spells out the sign for screen readers', () => {
    expect(moneyAccessibilityLabel(-125000)).toBe('minus ₹1,250.00');
    expect(moneyAccessibilityLabel(125000, { signDisplay: 'always' })).toBe('plus ₹1,250.00');
    expect(moneyAccessibilityLabel(125000)).toBe('₹1,250.00');
  });
});

describe('formatPercent', () => {
  it('signs non-zero values and handles non-finite input', () => {
    expect(formatPercent(18.44)).toBe('+18.4%');
    expect(formatPercent(-6.06)).toBe('−6.1%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatAxisMoney', () => {
  it.each([
    [95_000, '₹950'],
    [4_500_000, '₹45K'],
    [150_000, '₹1.5K'],
    [12_000_000, '₹1.2L'],
    [3_000_000_000, '₹3Cr'],
    [-4_500_000, '−₹45K'],
  ])('%d paise → %s', (minor, label) => {
    expect(formatAxisMoney(minor)).toBe(label);
  });
});

describe('formatMoneyWhole', () => {
  it('drops paise for dense tables', () => {
    expect(formatMoneyWhole(18_642_049)).toBe('₹1,86,420');
    expect(formatMoneyWhole(-50_000, 'always')).toBe('−₹500');
  });
});
