import { useEffect, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import {
  currentSession,
  displayNameOf,
  onAuthChange,
  setAutoRefresh,
} from '@/lib/data/authRepository';
import { needsSecondStep } from '@/lib/data/mfaRepository';
import { isSupabaseConfigured } from '@/lib/data/supabaseClient';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { startCloudSync, stopCloudSync } from '@/features/sync/cloudSync';
import { useDevicePrefs } from '@/state/devicePrefs';
import { useSession } from './sessionStore';

/** Keeps `useSession` in step with Supabase Auth for the whole app. */
export function SessionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void useDevicePrefs.getState().hydrate();
    const session = useSession.getState();
    if (!isSupabaseConfigured()) {
      session.setPreview();
      return undefined;
    }
    let active = true;
    let latest = 0;
    // A password-only session of an account with two-step sign-in still owes its code.
    const signedIn = (user: { email?: string; user_metadata?: unknown }) => {
      const run = ++latest;
      const email = user.email ?? null;
      const name = displayNameOf(user);
      void needsSecondStep().then((needsCode) => {
        if (!active || run !== latest) return;
        if (needsCode) session.setNeedsCode(email, name);
        else session.setSignedIn(email, name);
      });
    };
    void currentSession().then((current) => {
      if (!active) return;
      if (current) signedIn(current.user);
      else session.setSignedOut();
    });
    const unsubscribe = onAuthChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') session.setRecovery(true);
      if (next) {
        signedIn(next.user);
      } else {
        latest += 1;
        // Signed out (here, elsewhere, or the session expired): stop syncing first, so
        // clearing the stores is never sent as a deletion, then drop anything entered.
        stopCloudSync();
        useExpenseStore.getState().resetPreview();
        useNotesStore.getState().resetPreview();
        usePortfolioStore.getState().resetPreview();
        useRecurringStore.getState().resetPreview();
        useGoalStore.getState().resetPreview();
        useSalaryStore.getState().resetPreview();
        useMarketStore.getState().enterPreview();
        session.setSignedOut();
      }
    });
    // The signed-in user's real data replaces the preview while they are signed in.
    const unsubscribeSync = useSession.subscribe((state, previous) => {
      if (state.status === 'signedIn' && previous.status !== 'signedIn') void startCloudSync();
      if (state.status !== 'signedIn' && previous.status === 'signedIn') stopCloudSync();
    });
    // Native apps refresh tokens only while in the foreground (Supabase guidance for RN).
    const appState =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (state) => setAutoRefresh(state === 'active'));
    return () => {
      active = false;
      unsubscribe();
      unsubscribeSync();
      appState?.remove();
    };
  }, []);
  return <>{children}</>;
}
