import { buy, sip } from '../__fixtures__';
import {
  monthlySipTotal,
  nextSipDate,
  pendingSipInstalments,
  sipDates,
  upcomingSips,
} from '../sips';

describe('SIP schedule', () => {
  it('lists instalment dates within the plan', () => {
    expect(
      sipDates(sip({ startDate: '2026-01-10', endDate: '2026-04-05' }), '2025-12-01', '2026-12-31'),
    ).toEqual(['2026-02-05', '2026-03-05', '2026-04-05']);
  });

  it('finds the next instalment and skips paused plans', () => {
    expect(nextSipDate(sip(), '2026-10-05')).toBe('2026-10-05');
    expect(nextSipDate(sip(), '2026-10-06')).toBe('2026-11-05');
    expect(nextSipDate(sip({ active: false }), '2026-10-06')).toBeNull();
    expect(nextSipDate(sip({ endDate: '2026-10-01' }), '2026-10-06')).toBeNull();
  });

  it('sorts upcoming instalments', () => {
    const list = upcomingSips([sip({ id: 'a', day: 20 }), sip({ id: 'b', day: 10 })], '2026-10-08');
    expect(list.map((item) => [item.sip.id, item.date])).toEqual([
      ['b', '2026-10-10'],
      ['a', '2026-10-20'],
    ]);
  });

  it('lists instalments with no linked purchase', () => {
    const recorded = buy('2026-09-07', 500000, 1, 1, { sipId: 's1' });
    expect(
      pendingSipInstalments([sip()], [recorded], '2026-10-08').map((item) => item.date),
    ).toEqual(['2026-10-05']);
  });

  it('counts an imported purchase of the fund as the instalment, but not another fund', () => {
    const imported = buy('2026-10-06', 500000, 1, 1);
    expect(pendingSipInstalments([sip()], [imported], '2026-10-08').map((i) => i.date)).toEqual([
      '2026-09-05',
    ]);
    const otherFund = buy('2026-10-06', 500000, 1, 1, { fundId: 'f2' });
    expect(pendingSipInstalments([sip()], [otherFund], '2026-10-08')).toHaveLength(2);
    const otherSip = buy('2026-10-06', 500000, 1, 1, { sipId: 's2' });
    expect(pendingSipInstalments([sip()], [otherSip], '2026-10-08')).toHaveLength(2);
  });

  it('totals active plans per month', () => {
    expect(
      monthlySipTotal(
        [sip(), sip({ id: 'x', active: false }), sip({ id: 'y', endDate: '2026-01-31' })],
        '2026-10-08',
      ),
    ).toBe(500000);
  });
});
