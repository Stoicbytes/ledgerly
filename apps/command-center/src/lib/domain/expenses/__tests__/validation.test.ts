import {
  amountToInput,
  MAX_AMOUNT,
  parseAmount,
  parseLimitedAmount,
  validateDraft,
  validateName,
  type TransactionDraft,
} from '../validation';
import { accounts, categories } from '../__fixtures__/ledger';

describe('parseAmount', () => {
  it.each([
    ['250', 25_000],
    ['1,250.50', 125_050],
    ['₹ 99.9', 9_990],
    ['99.', 9_900],
    ['0', 0],
  ])('%s → %d paise', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '1e3', '12..5'])('rejects %p', (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it('round-trips to editable text', () => {
    expect(amountToInput(125_050)).toBe('1250.50');
    expect(amountToInput(25_000)).toBe('250');
    expect(amountToInput(0)).toBe('');
  });
});

const draft = (patch: Partial<TransactionDraft>): TransactionDraft => ({
  kind: 'expense',
  date: '2026-10-07',
  amountText: '250',
  categoryId: 'tea',
  accountId: 'cash',
  toAccountId: null,
  feeText: '',
  splits: [],
  splitMode: 'equal',
  myShareText: '',
  personId: null,
  photo: null,
  note: '  Masala tea  ',
  ...patch,
});
const context = { accounts, categories };

describe('limits the database enforces', () => {
  it('refuses amounts above ₹100 crore and dates outside 1900–2100', () => {
    expect(parseLimitedAmount('1000000000')).toBe(MAX_AMOUNT);
    expect(parseLimitedAmount('1000000000.01')).toBeNull();
    expect(parseLimitedAmount('abc')).toBeNull();
    expect(validateDraft(draft({ date: '1899-12-31' }), context).errors.date).toBeDefined();
    expect(validateDraft(draft({ date: '2101-01-01' }), context).errors.date).toBeDefined();
    expect(validateDraft(draft({ date: '2100-12-31' }), context).errors.date).toBeUndefined();
  });
});

describe('validateDraft', () => {
  it('produces a clean transaction value', () => {
    const { errors, value } = validateDraft(draft({}), context);
    expect(errors).toEqual({});
    expect(value).toEqual({
      kind: 'expense',
      date: '2026-10-07',
      amount: 25_000,
      accountId: 'cash',
      toAccountId: null,
      fee: 0,
      categoryId: 'tea',
      note: 'Masala tea',
      splits: [],
      personId: null,
      settles: [],
      photo: null,
    });
  });

  it('keeps valid splits on expenses and rejects shares above the amount', () => {
    const people = [{ id: 'ravi', name: 'Ravi', order: 0 }];
    const custom = (amountText: string, myShareText: string) =>
      validateDraft(
        draft({
          splits: [{ personId: 'ravi', amountText }],
          splitMode: 'custom',
          myShareText,
        }),
        { ...context, people },
      );
    expect(custom('100', '150').value?.splits).toEqual([{ personId: 'ravi', amount: 10_000 }]);
    expect(custom('300', '0').errors.split).toBe('Shares add up to more than the expense.');
    // Custom shares, yours included, must add up to the amount (₹250).
    expect(custom('100', '100').errors.split).toBe(
      'Shares add up to ₹200.00, not ₹250.00 (₹50.00 left to assign).',
    );
    expect(custom('100', '').errors.split).toBe('Enter your share (0 if you paid only for them).');
    // Equal modes work the shares out from the amount, whatever was typed.
    const equal = validateDraft(
      draft({ splits: [{ personId: 'ravi', amountText: '1' }], splitMode: 'others' }),
      { ...context, people },
    );
    expect(equal.value?.splits).toEqual([{ personId: 'ravi', amount: 25_000 }]);
    const unknown = validateDraft(draft({ splits: [{ personId: 'gone', amountText: '10' }] }), {
      ...context,
      people,
    });
    expect(unknown.errors.split).toBe('Someone in the split no longer exists.');
  });

  it('accepts a repayment without a category', () => {
    const people = [{ id: 'ravi', name: 'Ravi', order: 0 }];
    const { errors, value } = validateDraft(
      draft({ kind: 'income', categoryId: null, personId: 'ravi' }),
      { ...context, people },
    );
    expect(errors).toEqual({});
    expect(value).toMatchObject({ kind: 'income', categoryId: null, personId: 'ravi' });
  });

  it('reports every problem with a field-specific message', () => {
    const { errors, value } = validateDraft(
      draft({
        date: '2026-02-30',
        amountText: '0',
        categoryId: 'salary',
        accountId: 'nope',
        note: 'x'.repeat(121),
      }),
      context,
    );
    expect(value).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(['account', 'amount', 'category', 'date', 'note']);
    expect(errors.category).toMatch(/expense category/);
  });

  it('rejects amounts above the ceiling', () => {
    expect(validateDraft(draft({ amountText: String(MAX_AMOUNT) }), context).errors.amount).toMatch(
      /too large/,
    );
  });

  it('validates transfers: different accounts, optional fee, no category', () => {
    const same = validateDraft(
      draft({ kind: 'transfer', accountId: 'bank', toAccountId: 'bank' }),
      context,
    );
    expect(same.errors.toAccount).toMatch(/different/);
    const ok = validateDraft(
      draft({
        kind: 'transfer',
        accountId: 'bank',
        toAccountId: 'card',
        feeText: '10',
        categoryId: 'tea',
      }),
      context,
    );
    expect(ok.value).toMatchObject({
      kind: 'transfer',
      toAccountId: 'card',
      fee: 1_000,
      categoryId: null,
    });
    expect(
      validateDraft(
        draft({ kind: 'transfer', accountId: 'bank', toAccountId: 'card', feeText: 'x' }),
        context,
      ).errors.fee,
    ).toBeDefined();
  });
});

describe('validateName', () => {
  const siblings = [
    { id: 'a', name: 'Food' },
    { id: 'b', name: 'Rent' },
  ];
  it('requires a unique, short name (case-insensitive)', () => {
    expect(validateName('  ', siblings)).toMatch(/Enter a name/);
    expect(validateName('food', siblings)).toMatch(/already used/);
    expect(validateName('Food', siblings, 'a')).toBeNull();
    expect(validateName('x'.repeat(31), siblings)).toMatch(/under 30/);
    expect(validateName('Travel', siblings)).toBeNull();
  });
});
