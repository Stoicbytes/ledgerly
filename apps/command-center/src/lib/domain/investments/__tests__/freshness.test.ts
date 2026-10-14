import { cleanRunMessage, lastTradingDay, priceFreshness } from '../freshness';
import type { RefreshRun } from '../types';

const run = (patch: Partial<RefreshRun>): RefreshRun => ({
  source: 'amfi',
  status: 'ok',
  finishedAt: '2026-10-13T15:00:00Z',
  dataDate: '2026-10-13',
  message: '',
  ...patch,
});

describe('lastTradingDay', () => {
  it('is the weekday before today, skipping weekends', () => {
    expect(lastTradingDay('2026-10-14')).toBe('2026-10-13'); // Wednesday → Tuesday
    expect(lastTradingDay('2026-10-12')).toBe('2026-10-09'); // Monday → Friday
    expect(lastTradingDay('2026-10-11')).toBe('2026-10-09'); // Sunday → Friday
  });
});

describe('priceFreshness', () => {
  it('is current when prices are from the last trading day', () => {
    expect(priceFreshness([run({})], 'funds', '2026-10-14')).toEqual({
      dataDate: '2026-10-13',
      source: 'amfi',
      stale: false,
      failure: null,
    });
    // Friday's NAVs are still the latest on Monday.
    const friday = run({ dataDate: '2026-10-09' });
    expect(priceFreshness([friday], 'funds', '2026-10-12').stale).toBe(false);
  });

  it('warns when prices are older than the last trading day', () => {
    expect(priceFreshness([run({ dataDate: '2026-10-09' })], 'funds', '2026-10-14').stale).toBe(
      true,
    );
  });

  it('reports a failed latest run with a cleaned message, per kind', () => {
    const runs = [
      run({}),
      run({
        source: 'nse',
        status: 'failed',
        dataDate: null,
        finishedAt: '2026-10-14T10:00:00Z',
        message:
          'fetch https://example.invalid/x?key=abc failed token=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      }),
    ];
    expect(priceFreshness(runs, 'funds', '2026-10-14').failure).toBeNull();
    const stocks = priceFreshness(runs, 'stocks', '2026-10-14');
    expect(stocks).toMatchObject({ dataDate: null, stale: false });
    expect(stocks.failure).toBe('fetch failed …');
  });

  it('ignores a failure older than the last good run', () => {
    const runs = [
      run({ status: 'failed', dataDate: null, finishedAt: '2026-10-12T10:00:00Z', message: 'x' }),
      run({}),
    ];
    expect(priceFreshness(runs, 'funds', '2026-10-14').failure).toBeNull();
  });

  it('keeps messages short', () => {
    expect(cleanRunMessage('a'.repeat(10) + ' word'.repeat(40))).toHaveLength(120);
    expect(cleanRunMessage('  ')).toBe('');
  });
});
