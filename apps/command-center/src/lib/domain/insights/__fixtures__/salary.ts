import type { Payslip, PfEntry } from '@/lib/domain/salary';

/** A payslip: gross ₹75,000 (Basic 50,000 + HRA 15,000 + Special 10,000). */
export const slip = (month: string, over: Partial<Payslip> = {}): Payslip => ({
  id: `s-${month}-${over.employerId ?? 'e1'}`,
  employerId: 'e1',
  month,
  paidOn: null,
  earnings: [
    { label: 'Basic', amount: 50_000_00 },
    { label: 'HRA', amount: 15_000_00 },
    { label: 'Special allowance', amount: 10_000_00 },
  ],
  deductions: [{ label: 'Professional tax', amount: 200_00 }],
  epfEmployee: 6_000_00,
  vpf: 0,
  tds: 5_000_00,
  employerEpf: 4_750_00,
  employerEps: 1_250_00,
  transactionId: null,
  note: '',
  createdAt: 0,
  ...over,
});

/** Pay lines for a gross of `amount` (one Basic line). */
export const pay = (amount: number) => ({ earnings: [{ label: 'Basic', amount }] });

let n = 0;
export const pf = (date: string, over: Partial<PfEntry> = {}): PfEntry => ({
  id: `pf${(n += 1)}`,
  kind: 'contribution',
  date,
  employerId: 'e1',
  payslipId: null,
  employee: 0,
  vpf: 0,
  employer: 0,
  pension: 0,
  rate: null,
  note: '',
  createdAt: n,
  ...over,
});
