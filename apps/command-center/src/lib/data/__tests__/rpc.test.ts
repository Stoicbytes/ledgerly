import { callFunction, callRpc, RpcError } from '../rpc';
import { getAuth } from '../supabaseClient';

jest.mock('../supabaseConfig', () => ({
  supabaseConfig: { url: 'https://abc.supabase.co', key: 'sb_publishable_test' },
}));
jest.mock('../supabaseClient', () => ({ getAuth: jest.fn() }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  jest.mocked(getAuth).mockReturnValue({
    getSession: async () => ({ data: { session: { access_token: 'user-token' } } }),
  } as unknown as ReturnType<typeof getAuth>);
});

describe('callRpc', () => {
  it('calls the function as the user with the publishable key', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '{"accounts":[]}' });
    expect(await callRpc('load_ledger')).toEqual({ accounts: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abc.supabase.co/rest/v1/rpc/load_ledger');
    expect(init.headers).toMatchObject({
      apikey: 'sb_publishable_test',
      Authorization: 'Bearer user-token',
    });
  });

  it('reports refused changes as final and outages as retryable', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ code: '23514' }) });
    const refused = await callRpc('sync_ledger', { p_changes: {} }).catch((error) => error);
    expect(refused).toBeInstanceOf(RpcError);
    expect(refused).toMatchObject({ status: 400, code: '23514', retryable: false });
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect(
      ((await callRpc('load_ledger').catch((error: unknown) => error)) as RpcError).retryable,
    ).toBe(true);
  });

  it('gives up on a request that hangs, as a retryable failure', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const pending = callRpc('sync_ledger', { p_changes: {} }).catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(await pending).toMatchObject({ status: 0, code: 'timeout', retryable: true });
    jest.useRealTimers();
  });

  it('does not send without a session', async () => {
    jest.mocked(getAuth).mockReturnValue({
      getSession: async () => ({ data: { session: null } }),
    } as unknown as ReturnType<typeof getAuth>);
    await expect(callRpc('load_ledger')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('callFunction', () => {
  it('posts to the Edge Function as the user', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '{"navs":{"status":"ok"}}' });
    expect(await callFunction('market-refresh')).toEqual({ navs: { status: 'ok' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abc.supabase.co/functions/v1/market-refresh');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer user-token' });
  });

  it('reports a function that is not deployed', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await expect(callFunction('market-refresh')).rejects.toMatchObject({
      status: 404,
      retryable: false,
    });
  });
});
