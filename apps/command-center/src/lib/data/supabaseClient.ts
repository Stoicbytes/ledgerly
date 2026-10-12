import { AuthClient } from '@supabase/auth-js';
import { Platform } from 'react-native';
import { authStorage } from './authStorage';
import { supabaseConfig } from './supabaseConfig';

type Auth = InstanceType<typeof AuthClient>;

let client: Auth | null = null;

/**
 * Supabase Auth for this app, or null in preview mode (no project configured).
 *
 * Built from `@supabase/auth-js` directly (the client `supabase-js` uses inside) so the
 * bundle carries no unused realtime, storage or functions clients; Phase 3 adds the
 * PostgREST client beside it. PKCE flow: password-reset links carry a one-time code
 * that only this browser can exchange. Created lazily so preview builds never connect.
 */
export function getAuth(): Auth | null {
  if (!supabaseConfig) return null;
  const { url, key } = supabaseConfig;
  client ??= new AuthClient({
    url: `${url}/auth/v1`,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    // Same key supabase-js uses, so sessions carry over when the data client arrives.
    storageKey: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`,
    flowType: 'pkce',
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  });
  return client;
}

export const isSupabaseConfigured = () => supabaseConfig !== null;
