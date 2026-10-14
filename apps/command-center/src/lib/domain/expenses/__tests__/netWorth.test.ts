import { netWorthAccounts, valuedOnInvestments, type Account } from '..';

const account = (id: string, name: string, group: Account['group']): Account => ({
  id,
  name,
  group,
  openingBalance: 0,
  order: 0,
});
const accounts = [
  account('bank', 'Main bank', 'bank'),
  account('card', 'Credit card', 'card'),
  account('loan', 'Car loan', 'loan'),
  account('ppf', 'PPF', 'investment'),
  account('fd', 'Fixed deposit', 'investment'),
  account('sip', 'Mutual funds (SIP)', 'investment'),
  account('demat', 'Demat', 'investment'),
];
const balances = new Map([
  ['bank', 50_000_00],
  ['card', -8_000_00],
  ['loan', -2_00_000_00],
  ['ppf', 3_00_000_00],
  ['fd', 1_00_000_00],
  ['sip', 2_50_000_00],
  ['demat', 75_000_00],
]);

describe('net worth accounts', () => {
  it('counts PPF and deposits in Savings & investments, not accounts valued on Investments', () => {
    const result = netWorthAccounts(accounts, balances, { funds: true, stocks: true });
    // 50,000 − 2,00,000 + 3,00,000 + 1,00,000; the card and the fund/share accounts are out
    expect(result.cash).toBe(2_50_000_00);
    expect(result.leftOut.map((item) => item.name)).toEqual(['Mutual funds (SIP)', 'Demat']);
    expect(result.shown.map((item) => item.account.id)).toEqual([
      'bank',
      'card',
      'ppf',
      'fd',
      'loan',
    ]);
  });

  it('counts a fund or share account when nothing is tracked on that page', () => {
    const result = netWorthAccounts(accounts, balances, { funds: false, stocks: false });
    expect(result.cash).toBe(2_50_000_00 + 2_50_000_00 + 75_000_00);
    expect(result.leftOut).toEqual([]);
    expect(
      valuedOnInvestments(account('x', 'Mutual funds', 'investment'), {
        funds: false,
        stocks: true,
      }),
    ).toBe(false);
    expect(
      valuedOnInvestments(account('x', 'Zerodha shares', 'investment'), {
        funds: false,
        stocks: true,
      }),
    ).toBe(true);
    // Only the Savings & investments group: a bank account named "SIP debit" is still cash
    expect(
      valuedOnInvestments(account('x', 'SIP debit', 'bank'), {
        funds: true,
        stocks: true,
      }),
    ).toBe(false);
    // "Emergency fund" is savings, not a mutual fund
    expect(
      valuedOnInvestments(account('x', 'Emergency fund', 'investment'), {
        funds: true,
        stocks: true,
      }),
    ).toBe(false);
  });
});
