import { useSession } from '@/features/auth/sessionStore';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import { loadSamples } from './samples';

/**
 * Loads the sample data and fills the stores with it, only while the app is in preview
 * mode (checked again once loaded, so a sign-in meanwhile never gets sample data).
 */
export async function showSamples(): Promise<boolean> {
  await loadSamples();
  if (useSession.getState().status !== 'preview') return false;
  useExpenseStore.getState().resetPreview();
  useNotesStore.getState().resetPreview();
  usePortfolioStore.getState().resetPreview();
  useRecurringStore.getState().resetPreview();
  useGoalStore.getState().resetPreview();
  useSalaryStore.getState().resetPreview();
  useMarketStore.getState().enterPreview();
  return true;
}
