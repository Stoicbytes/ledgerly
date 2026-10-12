import { RpcError } from '@/lib/data/rpc';
import { describeRefresh, refreshFailure } from '../marketStore';
import { usePortfolioStore } from '../portfolioStore';

describe('describeRefresh', () => {
  it('summarises a refresh for the user', () => {
    expect(describeRefresh({ navs: { status: 'ok' }, prices: { status: 'ok' } })).toBe(
      'NAVs updated; closing prices updated.',
    );
    expect(describeRefresh({ navs: { status: 'current' }, prices: { status: 'failed' } })).toBe(
      'Closing prices could not be fetched.',
    );
    expect(describeRefresh({ navs: { status: 'current' }, prices: { status: 'current' } })).toBe(
      'Prices are already up to date.',
    );
    expect(describeRefresh({ busy: true })).toMatch(/already running/);
  });
});

describe('portfolio store', () => {
  beforeEach(() =>
    usePortfolioStore
      .getState()
      .restorePortfolio({ funds: [], fundTxns: [], sips: [], stocks: [], trades: [] }),
  );

  it('refuses to delete a purchase a later redemption relies on', () => {
    const store = usePortfolioStore.getState();
    const fund = store.saveFund({
      schemeCode: null,
      name: 'F',
      category: '',
      fundHouse: '',
      folio: '',
      manualNav: null,
      manualNavDate: null,
      note: '',
    });
    const base = { amount: 1000, stampDuty: 0, nav: 10, sipId: null, note: '' };
    const purchase = store.saveFundTxn(fund.id, {
      ...base,
      kind: 'buy',
      date: '2026-01-01',
      units: 10,
    });
    store.saveFundTxn(fund.id, { ...base, kind: 'sell', date: '2026-02-01', units: 5 });
    expect(usePortfolioStore.getState().deleteFundTxn(purchase.id)).toBe(false);
    expect(usePortfolioStore.getState().fundTxns).toHaveLength(2);
  });

  it('deletes a fund with its transactions and SIPs, and unlinks deleted SIPs', () => {
    const store = usePortfolioStore.getState();
    const fund = store.saveFund({
      schemeCode: null,
      name: 'F',
      category: '',
      fundHouse: '',
      folio: '',
      manualNav: null,
      manualNavDate: null,
      note: '',
    });
    const sip = store.saveSip({
      fundId: fund.id,
      amount: 100000,
      day: 5,
      startDate: '2026-01-05',
      endDate: null,
      active: true,
      note: '',
    });
    store.saveFundTxn(fund.id, {
      kind: 'buy',
      date: '2026-01-05',
      amount: 100000,
      stampDuty: 0,
      units: 1,
      nav: 1000,
      sipId: sip.id,
      note: '',
    });
    usePortfolioStore.getState().deleteSip(sip.id);
    expect(usePortfolioStore.getState().fundTxns[0].sipId).toBeNull();
    const previous = usePortfolioStore.getState().deleteFund(fund.id);
    expect(usePortfolioStore.getState().fundTxns).toEqual([]);
    usePortfolioStore.getState().restorePortfolio(previous);
    expect(usePortfolioStore.getState().funds).toHaveLength(1);
  });
});

describe('refreshFailure', () => {
  it('names the likely cause', () => {
    expect(refreshFailure(new RpcError(404))).toMatch(/not set up yet/);
    expect(refreshFailure(new RpcError(0, 'network'))).toMatch(/not deployed yet.*ALLOWED_ORIGINS/);
    expect(refreshFailure(new RpcError(0, 'timeout'))).toMatch(/took too long/);
    expect(refreshFailure(new RpcError(500))).toMatch(/Try again in a few minutes/);
  });
});
