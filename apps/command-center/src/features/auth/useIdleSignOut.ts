import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { flushCloudSync } from '@/features/sync/cloudSync';
import { signOut } from '@/lib/data/authRepository';
import { useDevicePrefs } from '@/state/devicePrefs';
import { idlePhase, idleTimeoutMs, type IdlePhase } from './idle';
import { useSession } from './sessionStore';

const CHECK_EVERY_MS = 15_000;
const WEB_ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Signs a real (not preview) session out after the device's chosen stretch without
 * activity (none for "Never"), with a warning first. Activity is any touch, click, key or scroll; `markActive` is also
 * attached to the app shell's touch capture so native taps count. Time spent in the
 * background counts as idle: coming back after the limit signs out at once.
 */
export function useIdleSignOut() {
  const signedIn = useSession((state) => state.status === 'signedIn');
  const timeout = useDevicePrefs((state) => idleTimeoutMs(state.idleChoice, state.keepSignedIn));
  const enabled = signedIn && timeout !== null;
  const pathname = usePathname();
  const lastActive = useRef(0);
  const [phase, setPhase] = useState<IdlePhase>('active');

  const markActive = useCallback(() => {
    lastActive.current = Date.now();
    setPhase((current) => (current === 'warning' ? 'active' : current));
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    lastActive.current = Date.now();
    let ended = false;
    const check = () => {
      const next = idlePhase(Date.now(), lastActive.current, timeout ?? Infinity);
      setPhase(next);
      if (next === 'expired' && !ended) {
        ended = true;
        void flushCloudSync()
          .then(signOut)
          .then(() => {
            useSession.getState().setSignedOut();
            router.replace({
              pathname: '/sign-in',
              params: { reason: 'idle', redirect: pathname },
            });
          });
      }
    };
    const timer = setInterval(check, CHECK_EVERY_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const doc = Platform.OS === 'web' && typeof document !== 'undefined' ? document : null;
    WEB_ACTIVITY.forEach((name) => doc?.addEventListener(name, markActive, { passive: true }));
    const onVisible = () => doc?.visibilityState === 'visible' && check();
    doc?.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      appState.remove();
      WEB_ACTIVITY.forEach((name) => doc?.removeEventListener(name, markActive));
      doc?.removeEventListener('visibilitychange', onVisible);
    };
    // The pathname only names where to return; a new page is not activity by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timeout, markActive]);

  return { phase: enabled ? phase : ('active' as const), markActive };
}
