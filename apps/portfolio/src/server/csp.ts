import type { SiteConfig } from '../lib/config';

/**
 * The page's Content-Security-Policy. Scripts come only from this site, plus the one
 * small inline script in app.html (allowed by its hash, computed from the template so
 * the two can never drift apart). Images and requests may also reach the Supabase
 * project, and nothing may frame the page.
 */
const hashes = new Map<string, Promise<string[]>>();

async function inlineScriptHashes(template: string): Promise<string[]> {
  const scripts = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');
  return Promise.all(
    scripts.map(async (script) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(script));
      const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
      return `'sha256-${base64}'`;
    }),
  );
}

export async function contentSecurityPolicy(template: string, config: SiteConfig | null) {
  if (!hashes.has(template)) hashes.set(template, inlineScriptHashes(template));
  const scriptHashes = (await hashes.get(template)) ?? [];
  const supabase = config?.supabaseUrl ?? '';
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${supabase}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${supabase}`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}
