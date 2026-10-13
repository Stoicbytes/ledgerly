import { buildChanges, fromRemote, type CloudData } from '../ledgerRepository';

const employer = {
  id: 'e1',
  name: 'First Co',
  joined_on: '2020-06-01',
  left_on: null,
  note: '',
  created_at: '2026-01-01T00:00:00Z',
};
const payslip = {
  id: 'p1',
  employer_id: 'e1',
  pay_month: '2026-04-01',
  paid_on: '2026-04-30',
  earnings: [{ label: 'Basic', amount: 5_000_000 }],
  deductions: [{ label: 'Professional tax', amount: 20_000 }],
  epf_employee: 600_000,
  vpf: 0,
  tds: 380_000,
  employer_epf: 475_000,
  employer_eps: 125_000,
  transaction_id: null,
  note: '',
  created_at: '2026-04-30T00:00:00Z',
};
const entry = {
  id: 'f1',
  kind: 'interest',
  entry_date: '2026-03-31',
  employer_id: null,
  payslip_id: null,
  employee: 410_000,
  vpf: 0,
  employer: 320_000,
  pension: 0,
  rate: 8.25,
  note: '',
  created_at: '2026-04-01T00:00:00Z',
};

describe('salary and PF in the ledger', () => {
  it('reads them, and knows when the database has none yet (migration 0016)', () => {
    const data = fromRemote({ employers: [employer], payslips: [payslip], pf_entries: [entry] });
    expect(data.employers?.[0]).toMatchObject({
      name: 'First Co',
      joinedOn: '2020-06-01',
      leftOn: null,
    });
    expect(data.payslips?.[0]).toMatchObject({
      month: '2026-04',
      tds: 380_000,
      earnings: [{ label: 'Basic', amount: 5_000_000 }],
    });
    expect(data.pfEntries?.[0]).toMatchObject({ kind: 'interest', date: '2026-03-31', rate: 8.25 });
    expect(fromRemote({}).payslips).toBeUndefined();
  });

  it('sends what changed in the database’s names, and deletions', () => {
    const base = (): CloudData =>
      fromRemote({ employers: [employer], payslips: [payslip], pf_entries: [entry] });
    expect(buildChanges(base(), base())).toBeNull();
    const next = base();
    next.payslips = [{ ...next.payslips![0], tds: 400_000 }];
    next.pfEntries = [];
    const changes = buildChanges(base(), next)!;
    expect(changes.payslips).toEqual([
      expect.objectContaining({ id: 'p1', pay_month: '2026-04-01', tds: 400_000 }),
    ]);
    expect(changes.deleted?.pf_entries).toEqual(['f1']);
    expect(changes.employers).toBeUndefined();
  });

  it('never sends salary data to a database without it', () => {
    const without = fromRemote({});
    expect(buildChanges(without, { ...without, employers: undefined })).toBeNull();
  });
});
