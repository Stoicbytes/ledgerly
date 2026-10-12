import { buy, fund, sell } from '../__fixtures__';
import {
  fundAssetClass,
  fundCategoryLabel,
  fundPosition,
  fundQuote,
  navOn,
  sortFundTxns,
  unitsHeldOn,
} from '../funds';
import { EMPTY_MARKET, type MarketData } from '../types';

describe('fundPosition', () => {
  it('redeems the oldest units first and splits cost and proceeds by units', () => {
    const txns = [
      buy('2025-01-10', 100000, 100, 10),
      buy('2025-06-10', 200000, 100, 20),
      sell('2026-02-01', 450000, 150, 30),
    ];
    const position = fundPosition(txns, 25);
    expect(position.units4).toBe(500000);
    expect(position.invested).toBe(100000);
    expect(position.avgCost).toBe(20);
    expect(position.value).toBe(125000);
    expect(position.unrealised).toBe(25000);
    expect(position.realised).toBe(250000);
    expect(position.realisedLots).toEqual([
      {
        buyDate: '2025-01-10',
        sellDate: '2026-02-01',
        units4: 1000000,
        cost: 100000,
        proceeds: 300000,
        days: 387,
      },
      {
        buyDate: '2025-06-10',
        sellDate: '2026-02-01',
        units4: 500000,
        cost: 100000,
        proceeds: 150000,
        days: 236,
      },
    ]);
  });

  it('keeps fractional units exact and stamp duty in the cost', () => {
    const txns = [0, 1, 2].map((day) =>
      buy(`2026-01-0${day + 1}`, 100025, 0.1, 10000, { stampDuty: 25 }),
    );
    const position = fundPosition(txns, 10000);
    expect(position.units4).toBe(3000);
    expect(position.invested).toBe(300075);
    expect(position.value).toBe(300000);
  });

  it('counts dividends paid out as returns', () => {
    const txns = [
      buy('2026-01-01', 100000, 10, 100),
      { ...buy('2026-03-01', 5000, 0, 0), kind: 'dividend' as const, units: null, nav: null },
    ];
    const position = fundPosition(txns, 100);
    expect(position.dividends).toBe(5000);
    expect(position.flows).toEqual([
      { date: '2026-01-01', amount: -100000 },
      { date: '2026-03-01', amount: 5000 },
    ]);
  });

  it('puts purchases before redemptions on the same day', () => {
    const sale = sell('2026-01-01', 100, 1, 1, { createdAt: -1 });
    const purchase = buy('2026-01-01', 100, 1, 1);
    expect(sortFundTxns([sale, purchase])).toEqual([purchase, sale]);
    expect(unitsHeldOn([sale, purchase], '2026-01-01')).toBe(0);
    expect(unitsHeldOn([purchase], '2025-12-31')).toBe(0);
  });

  it('values nothing without a NAV', () => {
    expect(fundPosition([buy('2026-01-01', 100, 1, 1)], null)).toMatchObject({
      value: 0,
      unrealised: 0,
    });
  });
});

describe('fundQuote', () => {
  const market: MarketData = {
    ...EMPTY_MARKET,
    schemes: {
      '120465': { name: 'x', fundHouse: '', category: '', nav: 60, navDate: '2026-10-07' },
    },
    navHistory: {
      '120465': [
        ['2026-10-01', 57],
        ['2026-10-06', 59],
        ['2026-10-07', 60],
      ],
    },
  };

  it('uses the AMFI NAV with the previous one for the day change', () => {
    expect(fundQuote(fund(), [], market)).toEqual({
      price: 60,
      date: '2026-10-07',
      source: 'amfi',
      previous: 59,
    });
  });

  it('prefers a newer manual NAV, then falls back to the latest entry', () => {
    const manual = fund({ manualNav: 61, manualNavDate: '2026-10-08' });
    expect(fundQuote(manual, [], market)?.source).toBe('manual');
    expect(
      fundQuote(fund({ manualNav: 61, manualNavDate: '2026-10-01' }), [], market)?.source,
    ).toBe('amfi');
    const handEntered = fund({ schemeCode: null });
    expect(fundQuote(handEntered, [buy('2026-01-01', 100, 1, 42)], market)).toEqual({
      price: 42,
      date: '2026-01-01',
      source: 'last entry',
      previous: null,
    });
    expect(fundQuote(handEntered, [], market)).toBeNull();
  });

  it('looks up the NAV on a date', () => {
    expect(navOn(market, 120465, '2026-10-05')).toBe(57);
    expect(navOn(market, 120465, '2026-09-01')).toBeNull();
    expect(navOn(market, null, '2026-10-05')).toBeNull();
  });
});

describe('categories', () => {
  it.each([
    ['Equity Scheme - Large Cap Fund', 'Equity', 'Large Cap Fund'],
    ['Equity Scheme - ELSS', 'Equity', 'ELSS'],
    ['Debt Scheme - Liquid Fund', 'Debt', 'Liquid Fund'],
    ['Hybrid Scheme - Balanced Advantage', 'Hybrid', 'Balanced Advantage'],
    ['Other Scheme - Index Funds', 'Index & ETF', 'Index Funds'],
    ['Other Scheme - FoF Domestic', 'Other', 'FoF Domestic'],
    ['', 'Unclassified', 'Unclassified'],
  ])('%s → %s / %s', (category, assetClass, label) => {
    expect(fundAssetClass(category)).toBe(assetClass);
    expect(fundCategoryLabel(category)).toBe(label);
  });
});
