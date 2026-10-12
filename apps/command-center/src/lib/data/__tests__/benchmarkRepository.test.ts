import { benchmarkFromRemote } from '../benchmarkRepository';

describe('benchmarkFromRemote', () => {
  it('maps the fund and keeps only valid NAV points', () => {
    expect(
      benchmarkFromRemote({
        scheme_code: 120,
        name: 'Index Fund',
        category: 'Index Funds',
        nav: 150,
        nav_date: '2026-10-09',
        history: [['2026-10-08', 149.5], ['2026-10-09', '150.25'], ['bad'], ['2026-10-10', 0]],
      }),
    ).toEqual({
      schemeCode: 120,
      name: 'Index Fund',
      category: 'Index Funds',
      history: [
        ['2026-10-08', 149.5],
        ['2026-10-09', 150.25],
      ],
    });
  });

  it('is null when no fund is chosen', () => {
    expect(benchmarkFromRemote(null)).toBeNull();
    expect(benchmarkFromRemote({})).toBeNull();
  });
});
