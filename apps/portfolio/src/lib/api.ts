import type { SiteConfig } from './config';

/**
 * The three public functions of migration 0010, called with the publishable key
 * (visitors are anonymous; Row Level Security and the functions decide what they get).
 */
type Rpc = 'portfolio_public' | 'portfolio_preview' | 'portfolio_contact';

class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Request failed (${status})`);
  }
}

async function callRpc<T>(
  config: SiteConfig,
  name: Rpc,
  args: Record<string, unknown>,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 6000);
  try {
    const response = await (options.fetch ?? fetch)(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: config.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(response.status);
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  } catch (error) {
    throw error instanceof ApiError ? error : new ApiError(0);
  } finally {
    clearTimeout(timer);
  }
}

export const fetchPublished = (
  config: SiteConfig,
  options?: { fetch?: typeof fetch; timeoutMs?: number },
) => callRpc<unknown>(config, 'portfolio_public', { p_handle: config.handle }, options);

export const fetchPreview = (config: SiteConfig, token: string) =>
  callRpc<unknown>(config, 'portfolio_preview', { p_token: token });

export type ContactResult = 'sent' | 'invalid' | 'limited' | 'closed';

export async function sendMessage(
  config: SiteConfig,
  message: { name: string; email: string; message: string; trap: string; elapsedMs: number },
): Promise<ContactResult> {
  const result = await callRpc<string>(config, 'portfolio_contact', {
    p_handle: config.handle,
    p_name: message.name,
    p_email: message.email,
    p_message: message.message,
    p_trap: message.trap,
    p_elapsed_ms: Math.round(message.elapsedMs),
  });
  return result === 'sent' || result === 'invalid' || result === 'limited' || result === 'closed'
    ? result
    : 'invalid';
}
