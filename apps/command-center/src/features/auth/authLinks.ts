/** Paths whose emailed links carry a one-time sign-in code (PKCE): reset and email change. */
const AUTH_LINK_PATHS = ['reset-password', 'dashboard/settings'];

/**
 * The one-time code in an emailed auth link opened in the app (`ledgerly://reset-password?code=…`),
 * or null for any other link. Only the app's own auth paths count, so a link elsewhere in the
 * app can never start a sign-in.
 */
export function authCodeFrom(url: string | null): string | null {
  if (!url) return null;
  const match = /^[a-z][a-z0-9+.-]*:\/\/\/?([^?#]*)\?([^#]*)/i.exec(url);
  if (!match) return null;
  const path = match[1].replace(/^\/+|\/+$/g, '');
  if (!AUTH_LINK_PATHS.includes(path)) return null;
  const code = new URLSearchParams(match[2]).get('code');
  return code && /^[A-Za-z0-9-]{8,128}$/.test(code) ? code : null;
}
