/**
 * After `npm run build:site`: loads api/site.mjs the way Vercel runs it and checks a few
 * responses, with no settings and with a stubbed database that has nothing published.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const problems = [];
const check = (ok, message) => ok || problems.push(message);

check(existsSync(join(dist, 'dashboard.html')), 'dist/dashboard.html is missing');
check(!existsSync(join(dist, 'index.html')), 'dist/index.html would hide the portfolio at /');
check(
  existsSync(join(dist, 'site')) && readdirSync(join(dist, 'site')).some((f) => f.endsWith('.js')),
  'dist/site has no scripts',
);

for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'PORTFOLIO_HANDLE', 'SITE_URL']) {
  delete process.env[name];
  delete process.env[`EXPO_PUBLIC_${name}`];
}
const { GET } = await import('../api/site.mjs');
const get = (path) => GET(new Request(`https://example.test/api/site?path=${path}`));

const unconfigured = await get('');
const page = await unconfigured.text();
check(unconfigured.status === 503, `unconfigured home: status ${unconfigured.status}`);
check(page.includes('This site is not set up yet'), 'unconfigured home: missing message');
check(page.includes('href="/dashboard"'), 'unconfigured home: no Dashboard link');
check(/src="\/site\/[^"]+\.js"/.test(page), 'home: does not load /site/ scripts');
check(Boolean(unconfigured.headers.get('Content-Security-Policy')), 'home: no CSP');

const robots = await get('robots.txt');
check((await robots.text()).includes('Disallow: /preview'), 'robots.txt not served');

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_check';
process.env.PORTFOLIO_HANDLE = 'check';
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response('null', { status: 200 });
const unpublished = await get('');
globalThis.fetch = realFetch;
check(unpublished.status === 404, `nothing published: status ${unpublished.status}`);
check(
  (await unpublished.text()).includes('Nothing is published here yet'),
  'nothing published: missing message',
);

if (problems.length) {
  console.error(`Portfolio at / is not working:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Portfolio at /: home, robots.txt and the unpublished page respond as expected.');
