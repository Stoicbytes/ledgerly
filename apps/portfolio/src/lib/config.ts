/**
 * Settings for reaching the published portfolio. The page hands these to the browser,
 * so only values that are public by design are accepted: the project URL, the
 * publishable key and the handle. A secret or service-role key is refused outright.
 * Served by the dashboard's project, the dashboard's own EXPO_PUBLIC_ Supabase values
 * are used when SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are not set.
 */
export type SiteConfig = { supabaseUrl: string; key: string; handle: string };

export class UnsafeConfigError extends Error {}

const LOCAL = ['localhost', '127.0.0.1'];

function jwtRole(key: string): string | undefined {
  const payload = key.split('.')[1];
  if (!payload) return undefined;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: string }).role;
  } catch {
    return undefined;
  }
}

/** Null when not configured; throws when a value is set but unsafe. */
export function readConfig(env: Record<string, string | undefined>): SiteConfig | null {
  const url = (env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL)?.trim();
  const key = (env.SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim();
  const handle = env.PORTFOLIO_HANDLE?.trim().toLowerCase();
  if (!url || !key || !handle) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeConfigError('SUPABASE_URL is not a valid URL.');
  }
  if (parsed.protocol !== 'https:' && !LOCAL.includes(parsed.hostname)) {
    throw new UnsafeConfigError('SUPABASE_URL must use https.');
  }
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    throw new UnsafeConfigError('Use the publishable key: a secret key must never reach a page.');
  }
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(handle)) {
    throw new UnsafeConfigError('PORTFOLIO_HANDLE must be the site address set in the dashboard.');
  }
  return { supabaseUrl: parsed.origin, key, handle };
}

/** The canonical origin: SITE_URL when set (https), otherwise the request's own. */
export function siteOrigin(env: Record<string, string | undefined>, requestUrl: string): string {
  const configured = env.SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' || LOCAL.includes(url.hostname)) return url.origin;
    } catch {
      // Fall through to the request's origin.
    }
  }
  return new URL(requestUrl).origin;
}

/**
 * Where the header's Dashboard link goes: a path on this site (/dashboard, when the
 * dashboard serves the portfolio at its root) or an https address. Anything else, or
 * nothing, hides the link.
 */
export function dashboardUrl(env: Record<string, string | undefined>): string | null {
  const value = env.DASHBOARD_URL?.trim();
  if (!value) return null;
  if (/^\/(?!\/)[A-Za-z0-9/_-]*$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || LOCAL.includes(url.hostname)) return url.href;
  } catch {
    // Not a usable address.
  }
  return null;
}

export const mediaUrl = (config: SiteConfig | null, path: string) =>
  config ? `${config.supabaseUrl}/storage/v1/object/public/portfolio-media/${path}` : '';
