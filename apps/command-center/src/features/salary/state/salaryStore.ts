import { create } from 'zustand';
import { samples } from '@/features/preview/samples';
import type { SalaryData } from './seedSalary';

const sample = (): SalaryData =>
  samples()?.seedSalary() ?? { employers: [], payslips: [], pfEntries: [] };

type SalaryState = SalaryData & {
  /** False while signed in to a database without migration 0016: the page is hidden. */
  available: boolean;
  resetPreview: () => void;
};

/** Employers, payslips and the PF passbook; changes go through salaryActions. */
export const useSalaryStore = create<SalaryState>((set) => ({
  ...sample(),
  available: true,
  resetPreview: () => set({ ...sample(), available: true }),
}));
