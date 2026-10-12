import { create } from 'zustand';

/**
 * Where the signed-in user's data stands. `off`: preview build or signed out (sample
 * data, nothing saved). `loading`: fetching the ledger after sign-in. `saved` /
 * `saving`: in step with the cloud. `retrying`: offline or the server is busy; changes
 * wait on this device and are sent again. `loadFailed`: the ledger could not be read.
 */
export type SyncStatus = 'off' | 'loading' | 'loadFailed' | 'saved' | 'saving' | 'retrying';

type SyncState = {
  status: SyncStatus;
  /** A change the database refused was rolled back (shown once). */
  rejected: boolean;
  set: (status: SyncStatus) => void;
  setRejected: (rejected: boolean) => void;
};

export const useSyncStatus = create<SyncState>()((set) => ({
  status: 'off',
  rejected: false,
  set: (status) => set({ status }),
  setRejected: (rejected) => set({ rejected }),
}));

/** True while the app shows and saves the user's real data. */
export const isCloudActive = (status: SyncStatus) => status !== 'off';
