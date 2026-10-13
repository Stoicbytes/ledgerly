import { create } from 'zustand';
import { seedSalary, type SalaryData } from './seedSalary';

type SalaryState = SalaryData & {
  /** False while signed in to a database without migration 0016: the page is hidden. */
  available: boolean;
  resetPreview: () => void;
};

/** Employers, payslips and the PF passbook; changes go through salaryActions. */
export const useSalaryStore = create<SalaryState>((set) => ({
  ...seedSalary(),
  available: true,
  resetPreview: () => set({ ...seedSalary(), available: true }),
}));
