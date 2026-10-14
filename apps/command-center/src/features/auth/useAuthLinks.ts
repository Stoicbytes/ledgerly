import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { exchangeAuthCode } from '@/lib/data/authRepository';
import { authCodeFrom } from './authLinks';
import { useSession } from './sessionStore';

/**
 * Phone apps: an emailed reset or email-change link opens the app with a one-time code;
 * this exchanges it for a session (the browser does that by itself on the web). While it
 * runs, the session reads as loading, so the reset screen shows "Checking your link…".
 */
export function useAuthLinks() {
  useEffect(() => {
    let active = true;
    const handle = async (url: string | null) => {
      const code = authCodeFrom(url);
      if (!code) return;
      const before = useSession.getState().status;
      useSession.setState({ status: 'loading' });
      const ok = await exchangeAuthCode(code);
      // On success the auth listener sets the new state; on failure restore the old one.
      if (active && !ok && useSession.getState().status === 'loading') {
        useSession.setState({ status: before === 'loading' ? 'signedOut' : before });
      }
    };
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', ({ url }) => void handle(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
}
