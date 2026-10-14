import { create } from 'zustand';

/**
 * Where the signed-in user's data stands. `off`: preview build or signed out (sample
 * data, nothing saved). `loading`: fetching the ledger after sign-in. `saved` /
 * `saving`: in step with the cloud. `retrying`: offline or the server is busy; changes
 * wait on this device and are sent again. `expired`: the session ended (401); changes
 * wait until the user signs in again. `loadFailed`: the ledger could not be read.
 */
export type SyncStatus =
  'off' | 'loading' | 'loadFailed' | 'saved' | 'saving' | 'retrying' | 'expired';

/** A message about saving that stays until dismissed (a refused change, a conflict). */
export type SyncNotice = { id: number; tone: 'info' | 'warning'; message: string };

type SyncState = {
  status: SyncStatus;
  notices: SyncNotice[];
  set: (status: SyncStatus) => void;
  notify: (tone: SyncNotice['tone'], message: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 0;
/** Older notices give way so the list never grows without bound. */
const MAX_NOTICES = 4;

export const useSyncStatus = create<SyncState>()((set) => ({
  status: 'off',
  notices: [],
  set: (status) => set({ status }),
  notify: (tone, message) =>
    set((state) => ({
      notices: [...state.notices, { id: ++nextId, tone, message }].slice(-MAX_NOTICES),
    })),
  dismiss: (id) => set((state) => ({ notices: state.notices.filter((n) => n.id !== id) })),
}));

/** True while the app shows and saves the user's real data. */
export const isCloudActive = (status: SyncStatus) => status !== 'off';
