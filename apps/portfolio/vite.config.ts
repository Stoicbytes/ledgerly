import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Development server with the same server rendering as production: every page request
 * goes through src/entry-server.tsx, reading settings from .env (see .env.example).
 */
function serverRenderedPages(env: Record<string, string>): Plugin {
  return {
    name: 'portfolio-server-rendering',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.originalUrl ?? '/';
        const pathname = url.split('?')[0] ?? '/';
        const page =
          req.method === 'GET' &&
          !pathname.startsWith('/@') &&
          !pathname.startsWith('/node_modules/') &&
          (!/\.[a-z0-9]+$/i.test(pathname) || /^\/(sitemap\.xml|robots\.txt)$/.test(pathname));
        if (!page) return next();
        try {
          const template = await server.transformIndexHtml(url, await readFile('app.html', 'utf8'));
          const { handle } = await server.ssrLoadModule('/src/entry-server.tsx');
          const response = (await handle(new Request(new URL(url, 'http://localhost')), {
            template,
            env,
            dev: true,
          })) as Response;
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch (error) {
          server.ssrFixStacktrace(error as Error);
          next(error);
        }
      });
    },
  };
}

export default defineConfig(({ mode, isSsrBuild }) => ({
  appType: 'custom',
  plugins: [serverRenderedPages(loadEnv(mode, process.cwd(), ''))],
  build: {
    target: 'es2022',
    // Not /assets: served from the dashboard's project, Expo already uses that folder.
    assetsDir: 'site',
    rollupOptions: isSsrBuild ? {} : { input: 'app.html' },
  },
  ssr: { noExternal: true, target: 'node' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
}));
