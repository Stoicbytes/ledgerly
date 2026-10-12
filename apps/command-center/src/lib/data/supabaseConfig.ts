/**
 * Supabase connection settings, checked before any client is created.
 *
 * Only the project URL and the publishable key may reach the app: both are public by
 * design and Row Level Security protects the data. These guards refuse anything that would hand the browser server-level access.
 */
export type SupabaseConfig = { url: string; key: string };

export class UnsafeSupabaseConfigError extends Error {}

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

function decodeJwtRole(key: string): string | undefined {
  const payload = key.split('.')[1];
  if (!payload) return undefined;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: string }).role;
  } catch {
    return undefined;
  }
}

/**
 * Returns the config, or null when it is not set (the app then runs in labelled
 * preview mode). Throws when a value is set but unsafe.
 */
export function readSupabaseConfig(
  url: string | undefined,
  key: string | undefined,
): SupabaseConfig | null {
  const cleanUrl = url?.trim();
  const cleanKey = key?.trim();
  if (!cleanUrl || !cleanKey) return null;
  let parsed: URL;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    throw new UnsafeSupabaseConfigError('EXPO_PUBLIC_SUPABASE_URL is not a valid URL.');
  }
  if (parsed.protocol !== 'https:' && !LOCAL_HOSTS.includes(parsed.hostname)) {
    throw new UnsafeSupabaseConfigError('Supabase must use HTTPS outside local development.');
  }
  if (cleanKey.startsWith('sb_secret_')) {
    throw new UnsafeSupabaseConfigError(
      'A Supabase secret key cannot be used in the app. Use the publishable key.',
    );
  }
  if (decodeJwtRole(cleanKey) === 'service_role') {
    throw new UnsafeSupabaseConfigError(
      'A Supabase service-role key cannot be used in the app. Use the publishable key.',
    );
  }
  return { url: parsed.origin, key: cleanKey };
}

/** The app's config from EXPO_PUBLIC_* variables (inlined into the bundle at build time). */
export const supabaseConfig = readSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
