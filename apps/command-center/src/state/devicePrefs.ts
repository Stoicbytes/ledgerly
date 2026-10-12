import { create } from 'zustand';
import { isIdleChoice, type IdleChoice } from '@/features/auth/idle';
import { isKeptSignedIn, setKeptSignedIn } from '@/lib/data/authStorage';
import { readPref, writePref } from '@/lib/device/prefs';

const IDLE_KEY = 'cc.idleSignOut';

type DevicePrefsState = {
  /** The session survives closing the browser on this device (always true on native). */
  keepSignedIn: boolean;
  idleChoice: IdleChoice;
  setKeepSignedIn: (keep: boolean) => void;
  setIdleChoice: (choice: IdleChoice) => void;
  /** Loads the saved choices; called once at start-up. */
  hydrate: () => Promise<void>;
};

/** Per-device sign-in preferences. Nothing financial; never synced to the account. */
export const useDevicePrefs = create<DevicePrefsState>()((set) => ({
  keepSignedIn: isKeptSignedIn(),
  idleChoice: 'auto',
  setKeepSignedIn: (keepSignedIn) => {
    setKeptSignedIn(keepSignedIn);
    set({ keepSignedIn: isKeptSignedIn() });
  },
  setIdleChoice: (idleChoice) => {
    set({ idleChoice });
    void writePref(IDLE_KEY, idleChoice === 'auto' ? null : idleChoice);
  },
  hydrate: async () => {
    const saved = await readPref(IDLE_KEY);
    set({ keepSignedIn: isKeptSignedIn(), idleChoice: isIdleChoice(saved) ? saved : 'auto' });
  },
}));
