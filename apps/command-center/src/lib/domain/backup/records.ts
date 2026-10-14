import { NOTE_COLORS } from '@/theme/noteColors';
import {
  bool,
  date,
  decimal,
  int,
  list,
  millis,
  nullable,
  oneOf,
  optional,
  record,
  text,
  uuid,
} from './guard';

/**
 * One check per kind of record in an "Export everything" file (app field names), with
 * the limits the database enforces (migrations 0005–0016). A record that passes here can
 * be saved as it is, apart from rules across records (see rules.ts).
 */
const MONEY = 1_000_000_000_000;
const ORDER = int(0, 100_000);
const LEDGER_DATE = date('1900-01-01', '2100-12-31');
const MARKET_DATE = date('1990-01-01', '2100-12-31');
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const KINDS = ['expense', 'income', 'transfer'] as const;

export const accountCheck = record({
  id: uuid,
  name: text(60, 1),
  group: oneOf(['cash', 'bank', 'card', 'wallet', 'investment', 'loan'] as const),
  openingBalance: int(-MONEY, MONEY),
  order: ORDER,
});

export const categoryCheck = record({
  id: uuid,
  kind: oneOf(['expense', 'income'] as const),
  parentId: nullable(uuid),
  name: text(40, 1),
  icon: text(40, 1, /^[a-z0-9-]{1,40}$/),
  tint: int(0, 31),
  budget: nullable(int(0, MONEY)),
  order: ORDER,
});

export const personCheck = record({ id: uuid, name: text(30, 1), order: ORDER });

export const transactionCheck = record({
  id: uuid,
  kind: oneOf(KINDS),
  date: LEDGER_DATE,
  amount: int(1, MONEY),
  accountId: uuid,
  toAccountId: nullable(uuid),
  fee: int(0, MONEY),
  categoryId: nullable(uuid),
  note: text(500),
  createdAt: millis,
  splits: optional(list(record({ personId: uuid, amount: int(1, MONEY) }), 100), []),
  personId: optional(nullable(uuid), null),
  settles: optional(list(uuid, 1000), []),
  // Only the storage path of a receipt is exported; the photo itself is not in the file.
  receipt: optional(nullable(text(300)), null),
});

export const noteCheck = record({
  id: uuid,
  title: text(120),
  body: text(20_000),
  items: nullable(list(record({ id: text(100), text: text(300), done: bool }), 200)),
  color: oneOf(NOTE_COLORS),
  pinned: bool,
  archived: bool,
  labels: list(text(30, 1), 10),
  remindOn: optional(nullable(MARKET_DATE), null),
  trashedAt: optional(nullable(millis), null),
  createdAt: millis,
  updatedAt: optional(millis, 0),
});

export const recurringCheck = record({
  id: uuid,
  kind: oneOf(KINDS),
  amount: int(1, MONEY),
  accountId: uuid,
  toAccountId: nullable(uuid),
  fee: int(0, MONEY),
  categoryId: nullable(uuid),
  note: text(500),
  frequency: oneOf(['daily', 'weekly', 'monthly', 'yearly'] as const),
  startDate: LEDGER_DATE,
  nextDate: LEDGER_DATE,
  createdAt: millis,
});

export const goalCheck = record({
  id: uuid,
  name: text(60, 1),
  targetAmount: int(100, MONEY),
  targetDate: MARKET_DATE,
  expectedReturn: decimal(0, 30, 2),
  createdAt: millis,
});

export const fundCheck = record({
  id: uuid,
  schemeCode: nullable(int(1, 2_147_483_647)),
  isin: nullable(text(12, 0, ISIN)),
  name: text(200, 1),
  category: text(160),
  fundHouse: text(120),
  folio: text(40),
  manualNav: nullable(decimal(0, 1e14, 4, true)),
  manualNavDate: nullable(MARKET_DATE),
  note: text(500),
  archived: bool,
  order: ORDER,
  createdAt: millis,
  expenseRatio: optional(nullable(decimal(0, 5, 2)), null),
  goalId: optional(nullable(uuid), null),
});

export const sipCheck = record({
  id: uuid,
  fundId: uuid,
  amount: int(100, 10_000_000_000),
  day: int(1, 28),
  startDate: MARKET_DATE,
  endDate: nullable(MARKET_DATE),
  active: bool,
  note: text(200),
  createdAt: millis,
  stepUpPct: optional(decimal(0, 100, 2), 0),
});

export const fundTxnCheck = record({
  id: uuid,
  fundId: uuid,
  kind: oneOf(['buy', 'sell', 'dividend'] as const),
  date: MARKET_DATE,
  amount: int(1, MONEY),
  stampDuty: int(0, 100_000_000),
  units: nullable(decimal(0, 999_999_999_999, 4, true)),
  nav: nullable(decimal(0, 1e14, 4, true)),
  sipId: nullable(uuid),
  note: text(300),
  createdAt: millis,
});

export const stockCheck = record({
  id: uuid,
  isin: nullable(text(12, 0, ISIN)),
  symbol: text(30, 1, /^[A-Z0-9&._-]{1,30}$/),
  exchange: oneOf(['NSE', 'BSE'] as const),
  name: text(200, 1),
  sector: text(60),
  manualPrice: nullable(int(1, 100_000_000_000)),
  manualPriceDate: nullable(MARKET_DATE),
  note: text(500),
  archived: bool,
  order: ORDER,
  createdAt: millis,
});

export const tradeCheck = record({
  id: uuid,
  stockId: uuid,
  kind: oneOf(['buy', 'sell', 'bonus', 'split', 'dividend'] as const),
  date: MARKET_DATE,
  quantity: nullable(int(1, 1_000_000_000)),
  price: nullable(int(1, 100_000_000_000)),
  charges: int(0, 100_000_000_000),
  amount: nullable(int(1, MONEY)),
  ratioFrom: nullable(int(1, 1000)),
  ratioTo: nullable(int(1, 1000)),
  note: text(300),
  createdAt: millis,
});
