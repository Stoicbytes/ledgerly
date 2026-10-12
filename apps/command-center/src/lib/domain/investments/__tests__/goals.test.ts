import { sip } from '../__fixtures__';
import { goalProgress, monthsUntil, timeLeftLabel, type Goal } from '../goals';
import { sipAmountOn, stepUpProjection, stepUpSchedule } from '../sips';

const goal = (patch: Partial<Goal> = {}): Goal => ({
  id: 'g1',
  name: 'House',
  targetAmount: 120_000_00,
  targetDate: '2027-10-11',
  expectedReturn: 0,
  createdAt: 0,
  ...patch,
});

describe('goals', () => {
  it('counts whole months left', () => {
    expect(monthsUntil('2026-10-11', '2027-10-11')).toBe(12);
    expect(monthsUntil('2026-10-11', '2027-10-10')).toBe(11);
    expect(monthsUntil('2026-10-11', '2026-01-01')).toBe(0);
    expect(timeLeftLabel('2026-10-11', '2028-12-11')).toBe('2 years 2 months');
    expect(timeLeftLabel('2026-10-11', '2026-10-20')).toBe('Under a month');
    expect(timeLeftLabel('2026-10-11', '2026-10-01')).toBe('Date passed');
  });

  it('works out the monthly amount still needed, with and without growth', () => {
    expect(goalProgress(goal(), 0, '2026-10-11')).toMatchObject({
      months: 12,
      monthlyNeeded: 10_000_00,
      percent: 0,
    });
    const grown = goalProgress(goal({ expectedReturn: 12 }), 100_000_00, '2026-10-11');
    expect(grown.projected).toBe(11_268_250);
    expect(grown.percent).toBeCloseTo(83.33, 2);
    // The rest (7,31,750 paise) closed by 12 month-end payments growing at 1 % a month.
    expect(grown.monthlyNeeded).toBe(Math.ceil((731_750 * 0.01) / (1.01 ** 12 - 1)));
  });

  it('is reached when today’s value is at the target', () => {
    expect(goalProgress(goal(), 130_000_00, '2026-10-11')).toMatchObject({
      reached: true,
      percent: 100,
      monthlyNeeded: 0,
    });
  });
});

describe('SIP step-up', () => {
  it('raises the instalment once per full year since the start', () => {
    const stepped = sip({ amount: 500_000, startDate: '2026-01-05', stepUpPct: 10 });
    expect(sipAmountOn(stepped, '2026-12-31')).toBe(500_000);
    expect(sipAmountOn(stepped, '2027-01-05')).toBe(550_000);
    expect(sipAmountOn(stepped, '2028-01-04')).toBe(550_000);
    expect(sipAmountOn(stepped, '2028-01-05')).toBe(605_000);
    expect(sipAmountOn(sip({ amount: 500_000 }), '2030-01-05')).toBe(500_000);
  });

  it('shows the yearly amounts and what they add up to', () => {
    expect(stepUpSchedule(500_000, 10, 3)).toEqual([500_000, 550_000, 605_000]);
    expect(stepUpProjection(100, 0, 1, 0)).toEqual({ invested: 1_200, value: 1_200 });
    const grown = stepUpProjection(100_000, 10, 2, 12);
    expect(grown.invested).toBe(12 * 100_000 + 12 * 110_000);
    expect(grown.value).toBeGreaterThan(grown.invested);
  });
});
