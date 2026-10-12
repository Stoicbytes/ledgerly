import { renderToString } from 'react-dom/server';
import { App } from './app/App';
import type { InitialState } from './app/state';
import { handleRequest, type HandlerOptions } from './server/handler';

/**
 * The server bundle (built by `vite build --ssr`): the Vercel function and the local
 * preview server call `handle` for every page, sitemap and robots request.
 */
export const render = (state: InitialState) => renderToString(<App initial={state} />);

export function handle(
  request: Request,
  options: Omit<HandlerOptions, 'render'>,
): Promise<Response> {
  return handleRequest(request, { ...options, render });
}
