import { create } from 'zustand';

/** Set when Reset answered that its database function is missing (migration 0018). */
export const useResetMissing = create<{ missing: boolean }>(() => ({ missing: false }));

export type DbUpdate = { feature: string; file: string };

/** Features hidden because a migration has not been run, from the signals each one uses. */
export function missingUpdates(flags: {
  recurring: boolean;
  goals: boolean;
  noteExtras: boolean;
  salary: boolean;
  resetMissing: boolean;
}): DbUpdate[] {
  return [
    !flags.recurring && {
      feature: 'Recurring entries (Repeat)',
      file: '202610130012_recurring.sql',
    },
    !flags.goals && { feature: 'Investment goals', file: '202610140013_fund_goals.sql' },
    !flags.noteExtras && {
      feature: 'Note reminders and Recently deleted',
      file: '202610160015_note_reminders.sql',
    },
    !flags.salary && { feature: 'Salary & PF', file: '202610170016_salary_pf.sql' },
    flags.resetMissing && { feature: 'Reset data', file: '202610180018_reset_data.sql' },
  ].filter((item): item is DbUpdate => !!item);
}
