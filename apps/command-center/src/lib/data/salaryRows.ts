import type { Employer, PayLine, Payslip, PfEntry } from '@/lib/domain/salary';

/** `employers`, `payslips` and `pf_entries` (migration 0016) to and from the app. */
type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const date = (value: unknown) => (typeof value === 'string' && value ? value : null);
const id = (value: unknown) => (typeof value === 'string' && value ? value : null);
const time = (value: unknown) => Date.parse(str(value)) || 0;
const iso = (ms: number) => new Date(ms || Date.now()).toISOString();
const rows = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : undefined);

const lines = (value: unknown): PayLine[] =>
  Array.isArray(value)
    ? (value as Row[]).map((line) => ({ label: str(line.label), amount: num(line.amount) }))
    : [];

export const employersFromRemote = (value: unknown): Employer[] | undefined =>
  rows(value)?.map((row) => ({
    id: str(row.id),
    name: str(row.name),
    joinedOn: date(row.joined_on),
    leftOn: date(row.left_on),
    note: str(row.note),
    createdAt: time(row.created_at),
  }));

export const payslipsFromRemote = (value: unknown): Payslip[] | undefined =>
  rows(value)?.map((row) => ({
    id: str(row.id),
    employerId: str(row.employer_id),
    month: str(row.pay_month).slice(0, 7),
    paidOn: date(row.paid_on),
    earnings: lines(row.earnings),
    deductions: lines(row.deductions),
    epfEmployee: num(row.epf_employee),
    vpf: num(row.vpf),
    tds: num(row.tds),
    employerEpf: num(row.employer_epf),
    employerEps: num(row.employer_eps),
    transactionId: id(row.transaction_id),
    note: str(row.note),
    createdAt: time(row.created_at),
  }));

export const pfEntriesFromRemote = (value: unknown): PfEntry[] | undefined =>
  rows(value)?.map((row) => ({
    id: str(row.id),
    kind: str(row.kind) as PfEntry['kind'],
    date: str(row.entry_date),
    employerId: id(row.employer_id),
    payslipId: id(row.payslip_id),
    employee: num(row.employee),
    vpf: num(row.vpf),
    employer: num(row.employer),
    pension: num(row.pension),
    rate: typeof row.rate === 'number' ? row.rate : row.rate == null ? null : Number(row.rate),
    note: str(row.note),
    createdAt: time(row.created_at),
  }));

export const employerRow = (e: Employer) => ({
  id: e.id,
  name: e.name,
  joined_on: e.joinedOn,
  left_on: e.leftOn,
  note: e.note,
  created_at: iso(e.createdAt),
});

export const payslipRow = (p: Payslip) => ({
  id: p.id,
  employer_id: p.employerId,
  pay_month: `${p.month}-01`,
  paid_on: p.paidOn,
  earnings: p.earnings,
  deductions: p.deductions,
  epf_employee: p.epfEmployee,
  vpf: p.vpf,
  tds: p.tds,
  employer_epf: p.employerEpf,
  employer_eps: p.employerEps,
  transaction_id: p.transactionId,
  note: p.note,
  created_at: iso(p.createdAt),
});

export const pfEntryRow = (f: PfEntry) => ({
  id: f.id,
  kind: f.kind,
  entry_date: f.date,
  employer_id: f.employerId,
  payslip_id: f.payslipId,
  employee: f.employee,
  vpf: f.vpf,
  employer: f.employer,
  pension: f.pension,
  rate: f.rate,
  note: f.note,
  created_at: iso(f.createdAt),
});
