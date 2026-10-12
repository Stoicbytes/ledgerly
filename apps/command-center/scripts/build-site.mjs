/**
 * Adds the public portfolio (apps/portfolio) to this project's Vercel build, so the
 * portfolio is the site's home page and the dashboard stays at /dashboard. Run after
 * `npm run build:web` (Vercel's build command runs both):
 *   dist/site/, dist/favicon.svg  the portfolio's browser files
 *   site-server/                  its server bundle and page template, for api/site.mjs
 *   dist/dashboard.html           Expo's index.html, renamed so that / reaches the
 *                                 portfolio (static files win over rewrites on Vercel)
 * `--no-install` skips `npm ci` in apps/portfolio (when it is already installed).
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// npm scripts run from the package root.
const app = process.cwd();
const portfolio = join(app, '..', 'portfolio');
const dist = join(app, 'dist');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(join(portfolio, 'package.json'))) {
  fail(
    'apps/portfolio was not found next to this app. On Vercel, keep Settings → Build and ' +
      'Deployment → "Include files outside the root directory in the Build Step" turned on.',
  );
}
const shell = existsSync(join(dist, 'index.html')) ? 'index.html' : 'dashboard.html';
if (!existsSync(join(dist, shell))) fail('No web export in dist/. Run "npm run build:web" first.');

const run = (command) => execSync(command, { cwd: portfolio, stdio: 'inherit' });
// Vite and the other build tools are devDependencies: install them even if NODE_ENV=production.
if (!process.argv.includes('--no-install')) run('npm ci --include=dev');
run('npm run build');

if (shell === 'index.html') renameSync(join(dist, 'index.html'), join(dist, 'dashboard.html'));
rmSync(join(dist, 'site'), { recursive: true, force: true });
cpSync(join(portfolio, 'dist', 'site'), join(dist, 'site'), { recursive: true });
cpSync(join(portfolio, 'dist', 'favicon.svg'), join(dist, 'favicon.svg'));

const server = join(app, 'site-server');
rmSync(server, { recursive: true, force: true });
mkdirSync(server);
cpSync(join(portfolio, 'dist-server'), server, { recursive: true });
cpSync(join(portfolio, 'dist', 'app.html'), join(server, 'app.html'));
// The bundle is an ES module; this app's own package.json is CommonJS.
writeFileSync(join(server, 'package.json'), '{ "private": true, "type": "module" }\n');
console.log('Portfolio added: dist/site, dist/dashboard.html, site-server/');
