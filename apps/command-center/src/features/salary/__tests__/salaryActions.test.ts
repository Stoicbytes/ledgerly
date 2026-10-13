import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { netPay } from '@/lib/domain/salary';
import {
  deleteEmployer,
  deletePayslip,
  savePayslip,
  type PayslipInput,
} from '../state/salaryActions';
import { useSalaryStore } from '../state/salaryStore';

beforeEach(() => {
  useSalaryStore.getState().resetPreview();
  useExpenseStore.getState().resetPreview();
});

const input = (over: Partial<PayslipInput> = {}): PayslipInput => ({
  employerId: 'emp-sample',
  month: '2030-01',
  paidOn: '2030-01-31',
  earnings: [{ label: 'Basic', amount: 60_000_00 }],
  deductions: [],
  epfEmployee: 7_200_00,
  vpf: 0,
  tds: 4_000_00,
  employerEpf: 5_950_00,
  employerEps: 1_250_00,
  note: '',
  ...over,
});

describe('salary actions', () => {
  it('adds the PF contribution with the payslip and keeps it in step', () => {
    const slip = savePayslip(input(), null, null);
    const pf = () =>
      useSalaryStore.getState().pfEntries.filter((item) => item.payslipId === slip.id);
    expect(pf()).toEqual([
      expect.objectContaining({
        kind: 'contribution',
        date: '2030-01-01',
        employee: 7_200_00,
        pension: 1_250_00,
      }),
    ]);
    savePayslip(input({ epfEmployee: 8_000_00 }), slip.id, null);
    expect(pf()).toHaveLength(1);
    expect(pf()[0].employee).toBe(8_000_00);
    savePayslip(input({ epfEmployee: 0, employerEpf: 0, employerEps: 0 }), slip.id, null);
    expect(pf()).toHaveLength(0);
  });

  it('records the net pay as income once, and updates that entry', () => {
    const account = useExpenseStore.getState().accounts[0];
    const slip = savePayslip(input(), null, { accountId: account.id, categoryId: null });
    const income = () =>
      useExpenseStore.getState().transactions.filter((item) => item.id === slip.transactionId);
    expect(income()).toEqual([
      expect.objectContaining({ kind: 'income', amount: netPay(slip), date: '2030-01-31' }),
    ]);
    const again = savePayslip(input({ tds: 5_000_00 }), slip.id, {
      accountId: account.id,
      categoryId: null,
    });
    expect(again.transactionId).toBe(slip.transactionId);
    expect(income()[0].amount).toBe(netPay(again));
  });

  it('deletes a payslip with its contribution, with undo, and protects used employers', () => {
    const slip = savePayslip(input(), null, null);
    expect(deleteEmployer('emp-sample')).toBe(false);
    const undo = deletePayslip(slip.id)!;
    expect(useSalaryStore.getState().pfEntries.some((item) => item.payslipId === slip.id)).toBe(
      false,
    );
    undo();
    expect(useSalaryStore.getState().payslips.some((item) => item.id === slip.id)).toBe(true);
    expect(useSalaryStore.getState().pfEntries.some((item) => item.payslipId === slip.id)).toBe(
      true,
    );
  });
});
