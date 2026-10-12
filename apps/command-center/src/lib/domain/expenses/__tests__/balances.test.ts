import {
  accountBalance,
  balanceHistory,
  balanceSummary,
  sortAccounts,
  transactionEffect,
} from '../balances';
import { accounts, transactions } from '../__fixtures__/ledger';

describe('balances', () => {
  it('charges amount + fee to the source of a transfer and credits the destination', () => {
    const transfer = transactions.find((item) => item.id === 't5')!;
    expect(transactionEffect(transfer, 'bank')).toBe(-201_000);
    expect(transactionEffect(transfer, 'card')).toBe(200_000);
    expect(transactionEffect(transfer, 'cash')).toBe(0);
  });

  it('reduces the bank balance when a card bill is paid (regression for defect F1)', () => {
    // 50,000 + 80,000 − 10,000 rent − 100 uncategorised − (2,000 + 10 fee)
    expect(accountBalance(accounts[0], transactions)).toBe(11_789_000);
  });

  it('tracks card debt as a negative balance', () => {
    // −2,000 opening − 40 − 50 purchases + 2,000 bill payment
    expect(accountBalance(accounts[1], transactions)).toBe(-9_000);
  });

  it('respects the as-of date', () => {
    expect(accountBalance(accounts[1], transactions, '2026-09-30')).toBe(-204_000);
  });

  it('splits assets and liabilities', () => {
    const summary = balanceSummary(accounts, transactions);
    expect(summary.assets).toBe(11_789_000 + 70_000);
    expect(summary.liabilities).toBe(-9_000);
    expect(summary.total).toBe(11_850_000);
  });
});

describe('sortAccounts', () => {
  it('orders by group, then by the account order', () => {
    const shuffled = [
      { ...accounts[0], id: 'bank-2', order: 5 },
      accounts[1],
      accounts[0],
      accounts[2],
    ];
    expect(sortAccounts(shuffled).map((account) => account.id)).toEqual([
      'cash',
      'bank',
      'bank-2',
      'card',
    ]);
  });
});

describe('balanceHistory', () => {
  it('reports month-end balances, oldest first', () => {
    // Card: −2,000 opening, −40 tea on 28 Sep; October adds −50 tea and the 2,000 bill payment.
    expect(balanceHistory(accounts[1], transactions, '2026-10', 3)).toEqual([
      { month: '2026-08', balance: -200_000 },
      { month: '2026-09', balance: -204_000 },
      { month: '2026-10', balance: -9_000 },
    ]);
  });
});
