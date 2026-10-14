import {
  contributionFromPayslip,
  contributionsByEmployer,
  estimateInterest,
  grossPay,
  lineSuggestions,
  netPay,
  payslipProblem,
  pfBalance,
  pfYears,
  salaryYears,
  totalDeductions,
  yearsWithoutInterest,
  type Payslip,
  type PfEntry,
} from '..';

const slip = (over: Partial<Payslip> = {}): Payslip => ({
  id: 's1',
  employerId: 'e1',
  month: '2025-04',
  paidOn: '2025-04-30',
  earnings: [
    { label: 'Basic', amount: 50_000_00 },
    { label: 'HRA', amount: 20_000_00 },
  ],
  deductions: [{ label: 'Professional tax', amount: 200_00 }],
  epfEmployee: 6_000_00,
  vpf: 1_000_00,
  tds: 5_000_00,
  employerEpf: 4_750_00,
  employerEps: 1_250_00,
  transactionId: null,
  note: '',
  createdAt: 1,
  ...over,
});

const pf = (over: Partial<PfEntry>): PfEntry => ({
  id: Math.random().toString(36),
  kind: 'contribution',
  date: '2025-04-01',
  employerId: 'e1',
  payslipId: null,
  employee: 0,
  vpf: 0,
  employer: 0,
  pension: 0,
  rate: null,
  note: '',
  createdAt: 0,
  ...over,
});

describe('payslips', () => {
  it('adds up pay: gross, every deduction and the net', () => {
    expect(grossPay(slip())).toBe(70_000_00);
    expect(totalDeductions(slip())).toBe(200_00 + 6_000_00 + 1_000_00 + 5_000_00);
    expect(netPay(slip())).toBe(57_800_00);
  });

  it('refuses a payslip that cannot be right', () => {
    expect(payslipProblem(slip(), [])).toBeNull();
    expect(payslipProblem(slip({ employerId: '' }), [])).toMatch(/employer/);
    expect(payslipProblem(slip({ earnings: [] }), [])).toMatch(/earning/);
    expect(payslipProblem(slip({ tds: 90_000_00 }), [])).toMatch(/more than/);
    expect(payslipProblem(slip({ deductions: [{ label: ' ', amount: 1 }] }), [])).toMatch(/name/);
    // the same employer and month twice; another employer that month is fine
    expect(payslipProblem(slip({ id: 's2' }), [slip()])).toMatch(/already/);
    expect(payslipProblem(slip({ id: 's2', employerId: 'e2' }), [slip()])).toBeNull();
  });

  it('turns a payslip into a PF contribution and keeps its id on edits', () => {
    const made = contributionFromPayslip(slip(), undefined, () => 'new');
    expect(made).toMatchObject({
      id: 'new',
      kind: 'contribution',
      date: '2025-04-01',
      employerId: 'e1',
      payslipId: 's1',
      employee: 6_000_00,
      vpf: 1_000_00,
      employer: 4_750_00,
      pension: 1_250_00,
    });
    const again = contributionFromPayslip(slip({ epfEmployee: 7_000_00 }), made!, () => 'other');
    expect(again?.id).toBe('new');
    const none = slip({ epfEmployee: 0, vpf: 0, employerEpf: 0, employerEps: 0 });
    expect(contributionFromPayslip(none, made!, () => 'x')).toBeNull();
  });

  it('totals each financial year, per employer, across a job change', () => {
    const years = salaryYears([
      slip({ id: 'a', month: '2025-02' }),
      slip({ id: 'b', month: '2025-03' }),
      slip({ id: 'c', month: '2025-04', employerId: 'e2' }),
    ]);
    expect(years.map((year) => year.fy)).toEqual(['FY 2025-26', 'FY 2024-25']);
    expect(years[1]).toMatchObject({ months: 2, gross: 140_000_00, tds: 10_000_00 });
    expect(years[1].pf).toBe(14_000_00);
    expect(years[1].employerPf).toBe(12_000_00);
    expect(years[0].byEmployer).toEqual([expect.objectContaining({ employerId: 'e2', months: 1 })]);
  });

  it('suggests line names used before, most used first', () => {
    const second = slip({ id: 'x', earnings: [{ label: 'HRA', amount: 1 }] });
    expect(lineSuggestions([slip(), second], 'earnings')).toEqual(['HRA', 'Basic']);
  });
});

describe('PF', () => {
  const entries = [
    pf({
      kind: 'opening',
      date: '2024-03-31',
      employee: 1_00_000_00,
      employer: 80_000_00,
      pension: 20_000_00,
      employerId: null,
    }),
    pf({
      date: '2024-04-01',
      employee: 6_000_00,
      vpf: 1_000_00,
      employer: 4_750_00,
      pension: 1_250_00,
    }),
    pf({
      kind: 'interest',
      date: '2025-03-31',
      employee: 8_000_00,
      employer: 6_000_00,
      rate: 8.25,
      employerId: null,
    }),
    pf({ kind: 'withdrawal', date: '2025-06-10', employee: 10_000_00, employerId: null }),
    pf({
      date: '2025-07-01',
      employerId: 'e2',
      employee: 7_000_00,
      employer: 5_000_00,
      pension: 1_250_00,
    }),
  ];

  it('keeps your share, the employer share and pension apart', () => {
    const balance = pfBalance(entries);
    expect(balance.employee).toBe(1_00_000_00 + 7_000_00 + 8_000_00 - 10_000_00 + 7_000_00);
    expect(balance.employer).toBe(80_000_00 + 4_750_00 + 6_000_00 + 5_000_00);
    expect(balance.total).toBe(balance.employee + balance.employer);
    expect(balance.pension).toBe(22_500_00);
    expect(balance.interest).toBe(14_000_00);
    expect(balance.withdrawn).toBe(10_000_00);
    expect(pfBalance(entries, '2024-12-31').total).toBe(1_80_000_00 + 11_750_00);
  });

  it('lists the passbook by financial year with the interest credited', () => {
    const years = pfYears(entries);
    expect(years.map((year) => year.fy)).toEqual(['FY 2025-26', 'FY 2024-25', 'FY 2023-24']);
    expect(years[1]).toMatchObject({
      opening: 1_80_000_00,
      contributed: 11_750_00,
      interest: 14_000_00,
      rate: 8.25,
    });
    expect(years[1].closing).toBe(1_80_000_00 + 11_750_00 + 14_000_00);
    expect(years[0]).toMatchObject({ withdrawn: 10_000_00, interest: null });
  });

  it('estimates a year of interest on the monthly balance', () => {
    // 1,20,000 on 1 April and nothing else at 8.25 %: 12 months × 1,20,000 × 8.25 / 1200
    const flat = [
      pf({ kind: 'opening', date: '2024-03-01', employee: 1_20_000_00, employerId: null }),
    ];
    expect(estimateInterest(flat, 'FY 2024-25', 8.25)).toBe(9_900_00);
    // 12,000 a month from April: the balance grows 12,000 each month-end
    const monthly = Array.from({ length: 12 }, (_, i) =>
      pf({
        date: `${i < 9 ? 2024 : 2025}-${String(((i + 3) % 12) + 1).padStart(2, '0')}-01`,
        employee: 12_000_00,
      }),
    );
    // Each month's wages earn from the next month: Σ k=0..11 of 12,000·k = 7,92,000;
    // × 8.25 / 1200 = 5,445 (March's 12,000 earns nothing this year)
    expect(estimateInterest(monthly, 'FY 2024-25', 8.25)).toBe(5_445_00);
    expect(estimateInterest([], 'FY 2024-25', 8.25)).toBe(0);
  });

  it('finds finished years with money in PF but no interest, gaps included', () => {
    const list = [
      pf({ kind: 'opening', date: '2022-05-01', employee: 50_000_00, employerId: null }),
      pf({
        kind: 'interest',
        date: '2023-03-31',
        employee: 2_000_00,
        rate: 8.15,
        employerId: null,
      }),
    ];
    // FY 2023-24 and 2024-25 had no entries at all, but the money was still there
    expect(yearsWithoutInterest(list, '2025-10-01')).toEqual(['FY 2023-24', 'FY 2024-25']);
    expect(yearsWithoutInterest([], '2025-10-01')).toEqual([]);
  });

  it('sums contributions per employer', () => {
    expect(contributionsByEmployer(entries)).toEqual([
      { employerId: 'e2', months: 1, amount: 12_000_00, pension: 1_250_00 },
      { employerId: 'e1', months: 1, amount: 11_750_00, pension: 1_250_00 },
    ]);
  });
});
