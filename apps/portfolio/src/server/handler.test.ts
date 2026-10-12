// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { InitialState } from '../app/state';
import { env, rawDocument } from '../test/fixture';
import { handleRequest } from './handler';

const INLINE = "(function(){document.documentElement.setAttribute('data-motion','pending')})()";
const template = `<html><head><script>${INLINE}</script><!--app-head--></head><body><div id="root"><!--app-html--></div><!--app-data--></body></html>`;

function serve(
  path: string,
  options: { document?: unknown; fail?: boolean; environment?: Record<string, string> } = {},
) {
  const fetch = vi.fn(async () =>
    options.fail
      ? Promise.reject(new Error('down'))
      : new Response(
          JSON.stringify(options.document === undefined ? rawDocument : options.document),
        ),
  );
  const render = vi.fn(
    (state: InitialState) => `<main data-mode="${state.mode}">${state.path}</main>`,
  );
  const response = handleRequest(new Request(`https://sam.example.com${path}`), {
    template,
    env: options.environment ?? env,
    render,
    fetch: fetch as unknown as typeof globalThis.fetch,
    now: () => new Date('2026-10-11T08:00:00Z'),
  });
  return { response, fetch, render };
}

describe('page handler', () => {
  it('renders the home page with caching, CSP and embedded state', async () => {
    const { response, fetch } = serve('/');
    const res = await response;
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(res.headers.get('X-Robots-Tag')).toBeNull();
    const hash = createHash('sha256').update(INLINE).digest('base64');
    expect(res.headers.get('Content-Security-Policy')).toContain(`'sha256-${hash}'`);
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(html).toContain('<main data-mode="live">/</main>');
    expect(html).toContain('<title>Sam Example — Software Engineer</title>');
    // A title containing </script> cannot break out of the embedded state.
    expect(html).not.toContain('Second </script> project');
    expect(fetch).toHaveBeenCalledWith(
      'https://project.supabase.co/rest/v1/rpc/portfolio_public',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ p_handle: 'sample' }) }),
    );
  });

  it('serves project pages and 404s for unknown ones (rewritten path too)', async () => {
    expect((await serve('/projects/first-project').response).status).toBe(200);
    const missing = await serve('/api/render?path=projects/nope').response;
    expect(missing.status).toBe(404);
    expect(missing.headers.get('X-Robots-Tag')).toContain('noindex');
    expect((await serve('/some/where').response).status).toBe(404);
  });

  it('says when nothing is published, settings are missing or the database is down', async () => {
    const unpublished = await serve('/', { document: null }).response;
    expect(unpublished.status).toBe(404);
    expect(await unpublished.text()).toContain('data-mode="unpublished"');
    const offline = await serve('/', { fail: true }).response;
    expect(offline.status).toBe(503);
    expect(offline.headers.get('Cache-Control')).toBe('no-store');
    const unconfigured = await serve('/', { environment: {} }).response;
    expect(unconfigured.status).toBe(503);
  });

  it('refuses unsafe settings without echoing them', async () => {
    const res = await serve('/', {
      environment: { ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' },
    }).response;
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('sb_secret_abc');
  });

  it('never caches or indexes previews and does not fetch the live site for them', async () => {
    const { response, fetch } = serve('/preview');
    const res = await response;
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(await res.text()).toContain('<meta name="referrer" content="no-referrer" />');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('passes the dashboard link to the page only when it is safe', async () => {
    const state = async (environment: Record<string, string>) => {
      const { response, render } = serve('/', { environment });
      await response;
      return render.mock.calls[0]?.[0];
    };
    expect((await state({ ...env, DASHBOARD_URL: '/dashboard' }))?.dashboardUrl).toBe('/dashboard');
    expect((await state({ ...env, DASHBOARD_URL: '//elsewhere' }))?.dashboardUrl).toBeNull();
    expect((await state({ DASHBOARD_URL: '/dashboard' }))?.mode).toBe('unconfigured');
  });

  it('serves the sitemap and robots.txt', async () => {
    const sitemap = await (await serve('/sitemap.xml').response).text();
    expect(sitemap).toContain('<loc>https://sam.example.com/projects/first-project</loc>');
    expect(sitemap).toContain('<lastmod>2026-10-01</lastmod>');
    const robots = await (await serve('/robots.txt').response).text();
    expect(robots).toContain('Disallow: /preview');
    expect(robots).toContain('Sitemap: https://sam.example.com/sitemap.xml');
  });
});
