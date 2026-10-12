import {
  addMonths,
  daysInMonth,
  monthOf,
  toIsoDate,
  type Transaction,
} from '@/lib/domain/expenses';
import { seeded } from '@/features/preview/random';
import { cat } from './seedCatalog';
import { daily, totalWeight } from './seedSpending';

// PREVIEW SEED — about eight months of sample activity up to today.

/** Sample transactions for the seven months before `today` plus this month to date. */
export function seedTransactions(today = new Date()): Transaction[] {
  const rows: Transaction[] = [];
  const end = toIsoDate(today);
  const thisMonth = monthOf(end);
  let previousCardSpend = 8_000_00;
  for (let offset = -7; offset <= 0; offset += 1) {
    const month = addMonths(thisMonth, offset);
    const random = seeded(Number(month.replace('-', '')));
    const rupees = (min: number, max: number) => Math.round(min + random() * (max - min)) * 100;
    let cardSpend = 0;
    let sequence = 0;
    const add = (
      day: number,
      row: Omit<Transaction, 'id' | 'date' | 'createdAt' | 'toAccountId' | 'fee' | 'note'> &
        Partial<Transaction>,
    ) => {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      if (date > end) return;
      if (row.kind === 'expense' && row.accountId === 'acc-card') cardSpend += row.amount;
      sequence += 1;
      rows.push({
        toAccountId: null,
        fee: 0,
        note: '',
        ...row,
        id: `seed-${month}-${sequence}`,
        date,
        createdAt: Date.parse(`${date}T08:00:00`) + sequence,
      });
    };
    add(1, {
      kind: 'income',
      amount: 85_000_00,
      accountId: 'acc-salary',
      categoryId: cat('income', 'Salary'),
      note: 'Monthly salary',
    });
    add(1, {
      kind: 'transfer',
      amount: 60_000_00,
      accountId: 'acc-salary',
      toAccountId: 'acc-main',
      categoryId: null,
      note: 'Move to main bank',
    });
    add(2, {
      kind: 'expense',
      amount: 14_000_00,
      accountId: 'acc-main',
      categoryId: cat('expense', 'Rent'),
      note: 'House rent',
    });
    add(3, {
      kind: 'expense',
      amount: 299_00,
      accountId: 'acc-card',
      categoryId: cat('expense', 'Mobile', 'Jio Recharge'),
    });
    add(5, {
      kind: 'transfer',
      amount: 14_000_00,
      accountId: 'acc-main',
      toAccountId: 'acc-sip',
      categoryId: null,
      note: 'Monthly SIP',
    });
    add(6, {
      kind: 'transfer',
      amount: 3_000_00,
      accountId: 'acc-main',
      toAccountId: 'acc-cash',
      fee: offset % 3 === 0 ? 21_00 : 0,
      categoryId: null,
      note: 'ATM withdrawal',
    });
    add(7, {
      kind: 'expense',
      amount: 15_000_00,
      accountId: 'acc-main',
      categoryId: cat('expense', 'Family', 'Monthly expense'),
      note: 'Home',
    });
    add(10, {
      kind: 'transfer',
      amount: previousCardSpend,
      accountId: 'acc-main',
      toAccountId: 'acc-card',
      categoryId: null,
      note: 'Credit card bill',
    });
    add(12, {
      kind: 'expense',
      amount: 119_00,
      accountId: 'acc-card',
      categoryId: cat('expense', 'Mobile', 'Spotify'),
    });
    if (offset % 2 === 0)
      add(15, {
        kind: 'income',
        amount: rupees(12_000, 25_000),
        accountId: 'acc-main',
        categoryId: cat('income', 'Freelance'),
        note: 'Client project',
      });
    if (offset % 3 === 0)
      add(daysInMonth(month), {
        kind: 'income',
        amount: 1_240_00,
        accountId: 'acc-main',
        categoryId: cat('income', 'Interest'),
      });
    for (let day = 1; day <= daysInMonth(month); day += 1) {
      const count = 1 + Math.floor(random() * 2.4);
      for (let index = 0; index < count; index += 1) {
        let roll = random() * totalWeight;
        const group = daily.find((item) => (roll -= item.weight) < 0) ?? daily[0];
        const pick = group.picks[Math.floor(random() * group.picks.length)];
        add(day, {
          kind: 'expense',
          amount: rupees(pick.min, pick.max),
          accountId: pick.accounts[Math.floor(random() * pick.accounts.length)],
          categoryId: cat('expense', pick.category, pick.sub),
          note:
            pick.notes && random() < 0.6
              ? pick.notes[Math.floor(random() * pick.notes.length)]
              : '',
        });
      }
    }
    previousCardSpend = cardSpend;
  }
  return rows;
}
