import { missingUpdates } from '../dbUpdates';

const all = { recurring: true, goals: true, noteExtras: true, salary: true, resetMissing: false };

describe('missingUpdates', () => {
  it('lists nothing when every migration is in place', () => {
    expect(missingUpdates(all)).toEqual([]);
  });

  it('names each hidden feature and the migration file to run', () => {
    const files = missingUpdates({
      ...all,
      noteExtras: false,
      salary: false,
      resetMissing: true,
    }).map((update) => update.file);
    expect(files).toEqual([
      '202610160015_note_reminders.sql',
      '202610170016_salary_pf.sql',
      '202610180018_reset_data.sql',
    ]);
  });
});
