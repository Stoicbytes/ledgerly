import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

type UiState = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
};

/**
 * Small, non-persisted UI state. Persistence moves to `user_preferences`
 * (Supabase) in Phase 3; nothing financial ever lives here.
 */
export const useUiStore = create<UiState>((set) => ({
  themePreference: 'system',
  setThemePreference: (themePreference) => set({ themePreference }),
}));
