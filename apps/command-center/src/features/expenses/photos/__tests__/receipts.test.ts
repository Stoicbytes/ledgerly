import { useSession } from '@/features/auth/sessionStore';
import {
  listReceipts,
  mediaFolder,
  removeReceipts,
  uploadReceiptFile,
} from '@/lib/data/storageRepository';
import type { Photo, Transaction } from '@/lib/domain/expenses';
import { cleanUnusedReceipts, storeReceipt } from '../receipts';

jest.mock('@/lib/data/storageRepository', () => ({
  listReceipts: jest.fn(),
  mediaFolder: jest.fn(),
  removeReceipts: jest.fn(),
  signedReceiptUrl: jest.fn(),
  uploadReceiptFile: jest.fn(),
}));

const photo: Photo = {
  uri: 'data:image/png;base64,AAAA',
  width: 300,
  height: 400,
  mimeType: 'IMAGE/PNG',
  bytes: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(mediaFolder).mockResolvedValue('user-1');
  global.fetch = jest.fn(async () => ({ blob: async () => new Blob(['x']) })) as never;
});

describe('storing receipts', () => {
  it('keeps the photo in memory in the preview', async () => {
    useSession.setState({ status: 'preview' });
    expect(await storeReceipt(photo)).toBe(photo);
    expect(uploadReceiptFile).not.toHaveBeenCalled();
  });

  it('uploads it into the user’s folder under a new name when signed in', async () => {
    useSession.setState({ status: 'signedIn' });
    const stored = await storeReceipt(photo);
    expect(stored.path).toMatch(/^user-1\/[0-9a-f-]{36}\.png$/);
    expect(stored.mimeType).toBe('image/png');
    expect(stored.uri).toBe(photo.uri);
    expect(uploadReceiptFile).toHaveBeenCalledWith(stored.path, expect.any(Blob), 'image/png');
  });

  it('fails when the upload is refused (nothing is attached)', async () => {
    useSession.setState({ status: 'signedIn' });
    jest.mocked(uploadReceiptFile).mockRejectedValueOnce(new Error('403'));
    await expect(storeReceipt(photo)).rejects.toThrow('403');
  });
});

describe('cleaning unused receipts', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const withPhoto = (path: string) => ({ id: path, photo: { ...photo, path } }) as Transaction;

  it('removes only files no entry uses that are a day old or more', async () => {
    jest.mocked(listReceipts).mockResolvedValue([
      { path: 'user-1/used.jpg', createdAt: '2026-10-01T00:00:00Z' },
      { path: 'user-1/old.jpg', createdAt: '2026-10-01T00:00:00Z' },
      { path: 'user-1/new.jpg', createdAt: '2026-10-11T11:00:00Z' },
      { path: 'user-1/unknown.jpg', createdAt: '' },
    ]);
    expect(await cleanUnusedReceipts([withPhoto('user-1/used.jpg')], now)).toBe(1);
    expect(listReceipts).toHaveBeenCalledWith('user-1');
    expect(removeReceipts).toHaveBeenCalledWith(['user-1/old.jpg']);
  });
});
