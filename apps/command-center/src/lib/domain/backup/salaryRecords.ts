import { date, decimal, int, list, millis, nullable, oneOf, record, text, uuid } from './guard';

/** Salary and PF records (migration 0016), with the database's limits. */
const MONEY = 1_000_000_000_000;
const SALARY_DATE = date('1950-01-01', '2100-12-31');

export const employerCheck = record({
  id: uuid,
  name: text(80, 1),
  joinedOn: nullable(SALARY_DATE),
  leftOn: nullable(SALARY_DATE),
  note: text(300),
  createdAt: millis,
});

const payLines = list(record({ label: text(60, 1), amount: int(0, MONEY) }), 30);

export const payslipCheck = record({
  id: uuid,
  employerId: uuid,
  month: text(7, 7, /^(19[5-9]\d|20\d\d|2100)-(0[1-9]|1[0-2])$/),
  paidOn: nullable(SALARY_DATE),
  earnings: payLines,
  deductions: payLines,
  epfEmployee: int(0, MONEY),
  vpf: int(0, MONEY),
  tds: int(0, MONEY),
  employerEpf: int(0, MONEY),
  employerEps: int(0, MONEY),
  transactionId: nullable(uuid),
  note: text(300),
  createdAt: millis,
});

export const pfEntryCheck = record({
  id: uuid,
  kind: oneOf(['contribution', 'interest', 'withdrawal', 'opening'] as const),
  date: SALARY_DATE,
  employerId: nullable(uuid),
  payslipId: nullable(uuid),
  employee: int(0, MONEY),
  vpf: int(0, MONEY),
  employer: int(0, MONEY),
  pension: int(0, MONEY),
  rate: nullable(decimal(0, 20, 2)),
  note: text(300),
  createdAt: millis,
});
