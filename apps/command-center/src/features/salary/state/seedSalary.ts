import { addMonths, monthOf, todayIso } from '@/lib/domain/expenses';
import { financialYear } from '@/lib/domain/investments/capitalGains';
import {
  estimateInterest,
  fyLabel,
  fyStartYear,
  type Employer,
  type Payslip,
  type PfEntry,
} from '@/lib/domain/salary';

/**
 * PREVIEW DATA: a fictional employer, fourteen months of payslips (with a raise from April)
 * and a PF passbook with interest up to the year before last, so the Salary & PF page and the
 * home screen can be tried before signing in. Signed in, your own data replaces it.
 */
export type SalaryData = { employers: Employer[]; payslips: Payslip[]; pfEntries: PfEntry[] };

const JOINED = '2023-06';
/** The rate entered with the sample interest (a fictional passbook). */
const SAMPLE_RATE = 8.25;

/** Pay before and after this financial year's raise; the newest three keep the raised pay. */
const PAY = {
  before: { basic: 40_500_00, hra: 16_200_00, special: 10_800_00, epf: 4_860_00, tds: 5_200_00 },
  after: { basic: 45_000_00, hra: 18_000_00, special: 12_000_00, epf: 5_400_00, tds: 6_500_00 },
};

const slipFor = (month: string, raised: boolean): Payslip => {
  const pay = raised ? PAY.after : PAY.before;
  return {
    id: `slip-${month}`,
    employerId: 'emp-sample',
    month,
    paidOn: null,
    earnings: [
      { label: 'Basic', amount: pay.basic },
      { label: 'HRA', amount: pay.hra },
      { label: 'Special allowance', amount: pay.special },
    ],
    deductions: [{ label: 'Professional tax', amount: 200_00 }],
    epfEmployee: pay.epf,
    vpf: 0,
    tds: pay.tds,
    employerEpf: pay.epf - 1_250_00,
    employerEps: 1_250_00,
    transactionId: null,
    note: '',
    createdAt: 0,
  };
};

const contribution = (slip: Payslip, withSlip: boolean): PfEntry => ({
  id: `pf-${slip.id}`,
  kind: 'contribution',
  date: `${slip.month}-01`,
  employerId: slip.employerId,
  payslipId: withSlip ? slip.id : null,
  employee: slip.epfEmployee,
  vpf: slip.vpf,
  employer: slip.employerEpf,
  pension: slip.employerEps,
  rate: null,
  note: '',
  createdAt: 0,
});

export function seedSalary(today = todayIso()): SalaryData {
  const employers: Employer[] = [
    {
      id: 'emp-sample',
      name: 'Sample Labs Pvt Ltd',
      joinedOn: `${JOINED}-01`,
      leftOn: null,
      note: '',
      createdAt: 0,
    },
  ];
  const raise = `${fyStartYear(financialYear(today))}-04`;
  const current = monthOf(today);
  // The newest three first (as before), then the eleven before them.
  const payslips = [3, 2, 1, ...Array.from({ length: 11 }, (_, index) => index + 4)].map((back) => {
    const month = addMonths(current, -back);
    return slipFor(month, back <= 3 || month >= raise);
  });
  const opening: PfEntry = {
    id: 'pf-opening',
    kind: 'opening',
    date: `${JOINED}-01`,
    employerId: null,
    payslipId: null,
    employee: 2_10_000_00,
    vpf: 0,
    employer: 1_60_000_00,
    pension: 45_000_00,
    rate: null,
    note: 'Carried over from the previous job',
    createdAt: 0,
  };
  // Months worked before the first sample payslip: contributions entered from the passbook.
  const earlier: PfEntry[] = [];
  for (let month = JOINED; month < addMonths(current, -14); month = addMonths(month, 1))
    earlier.push(contribution(slipFor(month, false), false));
  const entries = [opening, ...earlier, ...payslips.map((slip) => contribution(slip, true))];
  // Interest credited for every finished year but the last, which shows as still to add.
  const lastDone = fyStartYear(financialYear(today)) - 2;
  for (let year = Number(JOINED.slice(0, 4)); year <= lastDone; year += 1) {
    const fy = fyLabel(year);
    const interest = estimateInterest(entries, fy, SAMPLE_RATE);
    const employee = Math.round((interest * 0.55) / 100) * 100;
    entries.push({
      ...opening,
      id: `pf-interest-${year}`,
      kind: 'interest',
      date: `${year + 1}-03-31`,
      employee,
      employer: interest - employee,
      pension: 0,
      rate: SAMPLE_RATE,
      note: '',
    });
  }
  return { employers, payslips, pfEntries: entries };
}
