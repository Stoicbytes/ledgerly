import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The public portfolio at this site's root: /, /projects/…, /preview, /sitemap.xml and
 * /robots.txt are rewritten here (vercel.json); every other path is the dashboard.
 * Pages are rendered by the portfolio's server bundle, which `npm run build:site` builds
 * from apps/portfolio into site-server/. Settings are this project's environment
 * variables: the dashboard's own Supabase URL and publishable key, PORTFOLIO_HANDLE and,
 * optionally, SITE_URL. The portfolio's Dashboard button opens /dashboard (sign-in).
 */
let loaded = null;

function projectRoot() {
  const candidates = [join(dirname(fileURLToPath(import.meta.url)), '..'), process.cwd()];
  return (
    candidates.find((root) => existsSync(join(root, 'site-server/entry-server.js'))) ??
    candidates[0]
  );
}

function load() {
  loaded ??= (async () => {
    const dir = join(projectRoot(), 'site-server');
    const template = readFileSync(join(dir, 'app.html'), 'utf8');
    const server = await import(pathToFileURL(join(dir, 'entry-server.js')).href);
    return { server, template };
  })();
  return loaded;
}

export async function GET(request) {
  try {
    const { server, template } = await load();
    const env = { DASHBOARD_URL: '/dashboard', ...process.env };
    return await server.handle(request, { template, env });
  } catch {
    loaded = null;
    return new Response('The page could not be rendered. Please try again shortly.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

export const HEAD = GET;
