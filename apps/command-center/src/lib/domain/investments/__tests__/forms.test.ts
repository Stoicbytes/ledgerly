import { buy, sell, trade } from '../__fixtures__';
import {
  keepsUnitsCovered,
  parseDecimal,
  parseWhole,
  suggestStampDuty,
  unitsFor,
  validateFundTxn,
  type FundTxnDraft,
} from '../forms';
import { keepsSharesCovered, normaliseSymbol, validateTrade, type TradeDraft } from '../tradeForms';

const draft = (patch: Partial<FundTxnDraft> = {}): FundTxnDraft => ({
  kind: 'buy',
  date: '2026-10-07',
  amountText: '5,000',
  stampDutyText: '0.25',
  unitsText: '',
  navText: '58.12',
  note: '',
  sipId: null,
  ...patch,
});

const tradeDraft = (patch: Partial<TradeDraft> = {}): TradeDraft => ({
  kind: 'buy',
  date: '2026-10-07',
  quantityText: '10',
  priceText: '2,950.50',
  chargesText: '',
  amountText: '',
  ratioFromText: '',
  ratioToText: '',
  note: '',
  ...patch,
});

describe('number input', () => {
  it('parses decimals and whole numbers', () => {
    expect(parseDecimal('1,234.56789', 4)).toBeNull();
    expect(parseDecimal('1,234.5678', 4)).toBe(1234.5678);
    expect(parseDecimal('0', 4)).toBeNull();
    expect(parseWhole('1,200')).toBe(1200);
    expect(parseWhole('1.5')).toBeNull();
    expect(normaliseSymbol(' m&m ')).toBe('M&M');
    expect(normaliseSymbol('bad symbol')).toBeNull();
  });

  it('suggests stamp duty and units like a statement', () => {
    expect(suggestStampDuty(500000)).toBe(25);
    expect(unitsFor(500000, 25, 58.12)).toBe(86.025);
  });
});

describe('validateFundTxn', () => {
  it('works out the units of a purchase', () => {
    const { value } = validateFundTxn(draft(), []);
    expect(value).toMatchObject({
      kind: 'buy',
      amount: 500000,
      stampDuty: 25,
      units: 86.025,
      nav: 58.12,
    });
  });

  it('keeps typed units and refuses a redemption larger than the holding', () => {
    const held = [buy('2026-01-01', 100000, 10, 100)];
    expect(
      validateFundTxn(draft({ kind: 'sell', unitsText: '4.5', navText: '110' }), held).value?.units,
    ).toBe(4.5);
    expect(
      validateFundTxn(draft({ kind: 'sell', unitsText: '11', navText: '110' }), held).errors.units,
    ).toBe('Only 10.000 units were held on that date.');
    // Selling before a later redemption would leave it uncovered.
    const withSale = [...held, sell('2026-06-01', 100000, 8, 120)];
    expect(
      validateFundTxn(
        draft({ kind: 'sell', date: '2026-03-01', unitsText: '5', navText: '110' }),
        withSale,
      ).errors.units,
    ).toBe('This leaves a later redemption without enough units.');
  });

  it('records dividends without units', () => {
    expect(validateFundTxn(draft({ kind: 'dividend', navText: '' }), []).value).toMatchObject({
      units: null,
      nav: null,
      amount: 500000,
    });
  });

  it('reports missing fields', () => {
    expect(
      validateFundTxn(draft({ amountText: '', navText: 'x', date: '' }), []).errors,
    ).toMatchObject({
      date: 'Pick a date from 1990 to 2100.',
      amount: 'Enter the amount, like 5,000.',
      nav: 'Enter the NAV, like 58.1234.',
    });
  });

  it('checks that deletions keep redemptions covered', () => {
    const purchase = buy('2026-01-01', 100000, 10, 100);
    const sale = sell('2026-06-01', 100000, 8, 120);
    expect(keepsUnitsCovered([purchase, sale])).toBe(true);
    expect(keepsUnitsCovered([sale])).toBe(false);
  });
});

describe('validateTrade', () => {
  it('accepts a purchase in paise', () => {
    expect(validateTrade(tradeDraft({ chargesText: '20' }), []).value).toMatchObject({
      quantity: 10,
      price: 295050,
      charges: 2000,
    });
  });

  it('refuses a sale larger than the holding, including after splits', () => {
    const trades = [
      trade('buy', '2025-01-01', { quantity: 10, price: 100 }),
      trade('split', '2025-02-01', { ratioFrom: 1, ratioTo: 2 }),
    ];
    expect(
      validateTrade(tradeDraft({ kind: 'sell', quantityText: '20' }), trades).value?.quantity,
    ).toBe(20);
    expect(
      validateTrade(tradeDraft({ kind: 'sell', quantityText: '21' }), trades).errors.quantity,
    ).toBe('Only 20 shares were held on that date.');
    const withSale = [...trades, trade('sell', '2025-06-01', { quantity: 20, price: 100 })];
    expect(
      validateTrade(
        tradeDraft({ kind: 'split', ratioFromText: '2', ratioToText: '1', date: '2025-03-01' }),
        withSale,
      ).errors.quantity,
    ).toBe('This leaves a later sale without enough shares.');
    expect(keepsSharesCovered(withSale)).toBe(true);
  });

  it('checks ratios and dividends', () => {
    expect(
      validateTrade(tradeDraft({ kind: 'split', ratioFromText: '2', ratioToText: '2' }), []).errors
        .ratio,
    ).toBe('A split changes the number of shares.');
    expect(
      validateTrade(tradeDraft({ kind: 'bonus', ratioFromText: '1', ratioToText: '1' }), []).value,
    ).toMatchObject({ ratioFrom: 1, ratioTo: 1 });
    expect(
      validateTrade(tradeDraft({ kind: 'dividend', amountText: '120.50' }), []).value?.amount,
    ).toBe(12050);
  });
});

describe('limits the database enforces', () => {
  it('refuses dates outside 1990–2100, huge amounts and stamp duty over ₹10 lakh', () => {
    const errors = (patch: Parameters<typeof draft>[0]) => validateFundTxn(draft(patch), []).errors;
    expect(errors({ date: '1989-12-31' }).date).toBeDefined();
    expect(errors({ amountText: '1000000001' }).amount).toBeDefined();
    expect(errors({ amountText: '50000000', stampDutyText: '1000001' }).stampDuty).toBeDefined();
    expect(errors({}).date).toBeUndefined();
  });

  it('refuses trades the database would reject', () => {
    const errors = (patch: Partial<TradeDraft>) => validateTrade(tradeDraft(patch), []).errors;
    expect(errors({ date: '2101-01-01' }).date).toBeDefined();
    expect(errors({ quantityText: '1000000001' }).quantity).toBeDefined();
    expect(errors({ priceText: '1000000001' }).price).toBeDefined();
    expect(errors({ chargesText: '1000000001' }).charges).toBeDefined();
    expect(errors({ kind: 'dividend', amountText: '1000000001' }).amount).toBeDefined();
    expect(errors({ quantityText: '1000000000', priceText: '1' })).toEqual({});
  });
});
