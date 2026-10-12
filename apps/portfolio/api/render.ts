import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Vercel Function behind every page (see vercel.json rewrites). It loads the server
 * bundle built by `npm run build` and passes the request on; settings come from the
 * project's environment variables (see .env.example).
 */
type ServerModule = {
  handle: (
    request: Request,
    options: { template: string; env: Record<string, string | undefined> },
  ) => Promise<Response>;
};

let loaded: Promise<{ server: ServerModule; template: string }> | null = null;

function projectRoot(): string {
  const candidates = [process.cwd(), join(dirname(fileURLToPath(import.meta.url)), '..')];
  return (
    candidates.find((root) => existsSync(join(root, 'dist-server/entry-server.js'))) ??
    process.cwd()
  );
}

function load() {
  loaded ??= (async () => {
    const root = projectRoot();
    const template = readFileSync(join(root, 'dist/app.html'), 'utf8');
    const server = (await import(
      pathToFileURL(join(root, 'dist-server/entry-server.js')).href
    )) as ServerModule;
    return { server, template };
  })();
  return loaded;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { server, template } = await load();
    return await server.handle(request, { template, env: process.env });
  } catch {
    loaded = null;
    return new Response('The page could not be rendered. Please try again shortly.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

export const HEAD = GET;
