/**
 * Runs the production build locally the way Vercel serves it: files from dist/, every
 * other path through the server bundle (dist-server). Settings come from the
 * environment or .env (see .env.example). Build first: npm run build && npm run preview:local
 *
 * For checking layouts without a database, MOCK_DOCUMENT may name a JSON file shaped
 * like portfolio_public's result; Supabase calls are then answered from it. This is a
 * local testing aid only and is never part of the deployed site.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const port = Number(process.env.PORT ?? 4180);
const template = readFileSync(join(dist, 'app.html'), 'utf8');
const { handle } = await import(pathToFileURL(join(root, 'dist-server/entry-server.js')).href);

const TYPES = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

if (process.env.MOCK_DOCUMENT) {
  const document = readFileSync(process.env.MOCK_DOCUMENT, 'utf8');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/rest/v1/rpc/portfolio_public')) {
      return new Response(document, { headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(input, init);
  };
  console.log(`Answering portfolio_public from ${process.env.MOCK_DOCUMENT}`);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const file = normalize(join(dist, decodeURIComponent(url.pathname)));
  if (
    file.startsWith(dist) &&
    url.pathname !== '/app.html' &&
    existsSync(file) &&
    statSync(file).isFile()
  ) {
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
    return;
  }
  try {
    const response = await handle(new Request(url), { template, env: process.env });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end('Server error');
  }
}).listen(port, () => console.log(`Portfolio on http://localhost:${port}`));
