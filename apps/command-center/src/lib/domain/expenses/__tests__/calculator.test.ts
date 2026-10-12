import { evaluateAmount, isExpression } from '../calculator';

describe('amount calculator', () => {
  it.each([
    ['250', 25_000],
    ['1,250.50', 125_050],
    ['₹ 99.', 9_900],
    ['120+45', 16_500],
    ['1,200 - 150', 105_000],
    ['2×199', 39_800],
    ['2x199.50', 39_900],
    ['450/3', 15_000],
    ['100÷3', 3_333],
    ['200÷3', 6_667],
    ['(120+30)*2', 30_000],
    ['0.1+0.2', 30],
    ['-50+100', 5_000],
  ])('%s → %i paise', (input, expected) => {
    expect(evaluateAmount(input)).toBe(expected);
  });

  it.each(['', '+', '120+', '120++5', '1.234', '5/0', '50-100', '(1+2', 'abc', 'alert(1)', '1e5'])(
    'refuses %p',
    (input) => {
      expect(evaluateAmount(input)).toBeNull();
    },
  );

  it('tells a sum from a plain amount', () => {
    expect(isExpression('1,250.50')).toBe(false);
    expect(isExpression('120+45')).toBe(true);
    expect(isExpression('2×3')).toBe(true);
  });
});
