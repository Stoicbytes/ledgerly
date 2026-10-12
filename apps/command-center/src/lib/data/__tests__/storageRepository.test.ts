import { currentSession } from '../rpc';
import {
  listMedia,
  listReceipts,
  mediaFolder,
  removeMedia,
  removeReceipts,
  signedReceiptUrl,
  uploadMedia,
  uploadReceiptFile,
} from '../storageRepository';
import { getAuth } from '../supabaseClient';

jest.mock('../supabaseConfig', () => ({
  supabaseConfig: { url: 'https://abc.supabase.co', key: 'sb_publishable_test' },
}));
jest.mock('../supabaseClient', () => ({ getAuth: jest.fn() }));

const fetchMock = jest.fn();
const signIn = (session: unknown) =>
  jest.mocked(getAuth).mockReturnValue({
    getSession: async () => ({ data: { session } }),
  } as unknown as ReturnType<typeof getAuth>);

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  signIn({ access_token: 'user-token', user: { id: 'user-1' } });
});

describe('portfolio media storage', () => {
  it('uploads as the user into a new name, never overwriting', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await uploadMedia('user-1/a.webp', new Blob(['x']), 'image/webp');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abc.supabase.co/storage/v1/object/portfolio-media/user-1/a.webp');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer user-token',
      'x-upsert': 'false',
      'Content-Type': 'image/webp',
    });
  });

  it('lists and removes files in the user folder', async () => {
    expect(await mediaFolder()).toBe('user-1');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'a.webp', created_at: '2026-10-01T00:00:00Z' }, { name: null }],
    });
    expect(await listMedia('user-1')).toEqual([
      { path: 'user-1/a.webp', createdAt: '2026-10-01T00:00:00Z' },
    ]);
    await removeMedia([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await removeMedia(['user-1/a.webp']);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ prefixes: ['user-1/a.webp'] });
  });

  it('reports a refused upload and a missing session', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    await expect(uploadMedia('other/a.webp', new Blob(['x']), 'image/webp')).rejects.toMatchObject({
      status: 403,
    });
    signIn({ access_token: 'user-token' });
    await expect(currentSession()).rejects.toMatchObject({ status: 401 });
  });
});

describe('receipt storage', () => {
  it('uploads, lists and removes in the private bucket, never overwriting', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ name: 'r.jpg' }] });
    await uploadReceiptFile('user-1/r.jpg', new Blob(['x']), 'image/jpeg');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://abc.supabase.co/storage/v1/object/receipts/user-1/r.jpg',
    );
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ 'x-upsert': 'false' });
    expect(await listReceipts('user-1')).toEqual([{ path: 'user-1/r.jpg', createdAt: '' }]);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://abc.supabase.co/storage/v1/object/list/receipts',
    );
    await removeReceipts(['user-1/r.jpg']);
    expect(fetchMock.mock.calls[2][0]).toBe('https://abc.supabase.co/storage/v1/object/receipts');
  });

  it('shows a receipt through a link that expires after a minute', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ signedURL: '/object/sign/receipts/user-1/r.jpg?token=t' }),
    });
    expect(await signedReceiptUrl('user-1/r.jpg')).toBe(
      'https://abc.supabase.co/storage/v1/object/sign/receipts/user-1/r.jpg?token=t',
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abc.supabase.co/storage/v1/object/sign/receipts/user-1/r.jpg');
    expect(JSON.parse(init.body)).toEqual({ expiresIn: 60 });
  });

  it('fails when the link is missing', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(signedReceiptUrl('user-1/r.jpg')).rejects.toMatchObject({ code: 'storage' });
  });
});
