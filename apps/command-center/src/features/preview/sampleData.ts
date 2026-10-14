import { seedRules } from '@/features/expenses/state/seedRecurring';
import { seedAccounts, seedCategories } from '@/features/expenses/state/seedCatalog';
import { seedPeople, withSampleSplits } from '@/features/expenses/state/seedPeople';
import { seedTransactions } from '@/features/expenses/state/seedTransactions';
import { seedGoals } from '@/features/investments/state/seedGoals';
import { seedPortfolio } from '@/features/investments/state/seedPortfolio';
import { seedNotes } from '@/features/notes/state/seedNotes';
import { seedSalary } from '@/features/salary/state/seedSalary';

/** Everything the preview shows (its own file: see samples.ts). */
export const sampleLedger = () => ({
  accounts: seedAccounts(),
  categories: seedCategories(),
  transactions: withSampleSplits(seedTransactions()),
  people: seedPeople(),
});

export { seedGoals, seedNotes, seedPortfolio, seedRules, seedSalary };
