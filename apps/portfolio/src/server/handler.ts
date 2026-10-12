import { STATE_ELEMENT_ID, type InitialState, type Mode } from '../app/state';
import { fetchPublished } from '../lib/api';
import {
  dashboardUrl,
  readConfig,
  siteOrigin,
  UnsafeConfigError,
  type SiteConfig,
} from '../lib/config';
import { jsonForScript } from '../lib/escape';
import { normalizeDocument } from '../lib/normalize';
import { parseRoute } from '../lib/routes';
import { buildHead, findProject } from '../lib/seo';
import { contentSecurityPolicy } from './csp';
import { robotsTxt, sitemapXml } from './sitemap';

/**
 * Serves every page of the site (on Vercel, from one function behind rewrites): reads
 * the published document, renders the page on the server, and sets status codes and
 * caching. Pages are cached at the edge for a minute, so a publish shows within about
 * a minute without rebuilding or redeploying; the browser also re-checks old pages.
 */
export type RenderApp = (state: InitialState) => string;

export type HandlerOptions = {
  template: string;
  env: Record<string, string | undefined>;
  render: RenderApp;
  fetch?: typeof fetch;
  now?: () => Date;
  /** Development server: no CSP (Vite injects its own scripts). */
  dev?: boolean;
};

const LIVE_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
const SHORT_CACHE = 'public, max-age=0, s-maxage=30';

function requestPath(request: Request): string {
  const url = new URL(request.url);
  const rewritten = url.searchParams.get('path');
  return `/${(rewritten ?? url.pathname).replace(/^\/+|\/+$/g, '')}`;
}

async function loadDocument(config: SiteConfig, options: HandlerOptions) {
  try {
    const raw = await fetchPublished(config, { fetch: options.fetch, timeoutMs: 3500 });
    return { ok: true as const, document: normalizeDocument(raw) };
  } catch {
    return { ok: false as const, document: null };
  }
}

export async function handleRequest(request: Request, options: HandlerOptions): Promise<Response> {
  const path = requestPath(request);
  const now = (options.now ?? (() => new Date()))();
  const origin = siteOrigin(options.env, request.url);
  let config: SiteConfig | null;
  try {
    config = readConfig(options.env);
  } catch (error) {
    // Never echo the values; the message names only the setting to fix.
    const message = error instanceof UnsafeConfigError ? error.message : 'Invalid settings.';
    return new Response(`This site is not configured safely. ${message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (path === '/robots.txt') {
    return new Response(robotsTxt(origin), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': SHORT_CACHE },
    });
  }

  const route = parseRoute(path);
  const loaded =
    config && route.name !== 'preview'
      ? await loadDocument(config, options)
      : { ok: true, document: null };

  if (path === '/sitemap.xml') {
    return new Response(sitemapXml(origin, loaded.document), {
      status: loaded.document ? 200 : 404,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': SHORT_CACHE },
    });
  }

  let mode: Mode = 'live';
  let status = 200;
  let cache = LIVE_CACHE;
  if (!config) [mode, status, cache] = ['unconfigured', 503, 'no-store'];
  else if (route.name === 'preview') [mode, cache] = ['preview', 'no-store'];
  else if (!loaded.ok) [mode, status, cache] = ['offline', 503, 'no-store'];
  else if (!loaded.document) [mode, status, cache] = ['unpublished', 404, SHORT_CACHE];
  else if (
    route.name === 'notFound' ||
    (route.name === 'project' && !findProject(loaded.document, route))
  )
    status = 404;

  const state: InitialState = {
    path,
    mode,
    document: loaded.document,
    config,
    fetchedAt: now.getTime(),
    today: now.toISOString().slice(0, 10),
    origin,
    dashboardUrl: dashboardUrl(options.env),
  };
  const noindex = mode !== 'live' || status !== 200;
  const html = options.template
    .replace(
      '<!--app-head-->',
      buildHead({ document: loaded.document, route, origin, config, noindex }),
    )
    .replace('<!--app-html-->', options.render(state))
    .replace(
      '<!--app-data-->',
      `<script id="${STATE_ELEMENT_ID}" type="application/json">${jsonForScript(state)}</script>`,
    );

  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': cache,
  });
  if (!options.dev)
    headers.set('Content-Security-Policy', await contentSecurityPolicy(options.template, config));
  if (noindex) headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (mode === 'preview') headers.set('Referrer-Policy', 'no-referrer');
  if (status === 503) headers.set('Retry-After', '30');
  return new Response(html, { status, headers });
}
