import { addMonths, monthOf, todayIso } from '@/lib/domain/expenses';
import type { Employer, Payslip, PfEntry } from '@/lib/domain/salary';

/**
 * PREVIEW DATA: a fictional employer, the last three payslips and a PF passbook, so the
 * Salary & PF page can be tried before signing in. Signed in, your own data replaces it.
 */
export type SalaryData = { employers: Employer[]; payslips: Payslip[]; pfEntries: PfEntry[] };

export function seedSalary(today = todayIso()): SalaryData {
  const employers: Employer[] = [
    {
      id: 'emp-sample',
      name: 'Sample Labs Pvt Ltd',
      joinedOn: '2023-06-01',
      leftOn: null,
      note: '',
      createdAt: 0,
    },
  ];
  const payslips: Payslip[] = [3, 2, 1].map((back) => ({
    id: `slip-${back}`,
    employerId: 'emp-sample',
    month: addMonths(monthOf(today), -back),
    paidOn: null,
    earnings: [
      { label: 'Basic', amount: 45_000_00 },
      { label: 'HRA', amount: 18_000_00 },
      { label: 'Special allowance', amount: 12_000_00 },
    ],
    deductions: [{ label: 'Professional tax', amount: 200_00 }],
    epfEmployee: 5_400_00,
    vpf: 0,
    tds: 6_500_00,
    employerEpf: 4_150_00,
    employerEps: 1_250_00,
    transactionId: null,
    note: '',
    createdAt: 0,
  }));
  const pfEntries: PfEntry[] = [
    {
      id: 'pf-opening',
      kind: 'opening',
      date: '2023-06-01',
      employerId: null,
      payslipId: null,
      employee: 2_10_000_00,
      vpf: 0,
      employer: 1_60_000_00,
      pension: 45_000_00,
      rate: null,
      note: 'Carried over from the previous job',
      createdAt: 0,
    },
    ...payslips.map((slip) => ({
      id: `pf-${slip.id}`,
      kind: 'contribution' as const,
      date: `${slip.month}-01`,
      employerId: slip.employerId,
      payslipId: slip.id,
      employee: slip.epfEmployee,
      vpf: slip.vpf,
      employer: slip.employerEpf,
      pension: slip.employerEps,
      rate: null,
      note: '',
      createdAt: 0,
    })),
  ];
  return { employers, payslips, pfEntries };
}
