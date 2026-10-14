import { create } from 'zustand';
import type { RecurringEntry } from '@/lib/domain/expenses';
import { samples } from '@/features/preview/samples';

type RecurringState = {
  rules: RecurringEntry[];
  /** False while signed in to a database without migration 0012: Repeat is hidden. */
  available: boolean;
  resetPreview: () => void;
};

/** Recurring entries (rent, subscriptions, EMIs); changes go through recurringActions. */
export const useRecurringStore = create<RecurringState>((set) => ({
  rules: samples()?.seedRules() ?? [],
  available: true,
  resetPreview: () => set({ rules: samples()?.seedRules() ?? [], available: true }),
}));
