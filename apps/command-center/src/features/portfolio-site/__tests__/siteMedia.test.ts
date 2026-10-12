import { usedMediaPaths } from '@/lib/data/siteRepository';
import { listMedia, mediaFolder, removeMedia } from '@/lib/data/storageRepository';
import { cleanUnusedMedia } from '../state/siteMedia';

jest.mock('@/lib/data/siteRepository');
jest.mock('@/lib/data/storageRepository');

describe('cleaning unused uploads', () => {
  it('removes only old files that neither the drafts nor the live site use', async () => {
    const now = Date.parse('2026-10-11T12:00:00Z');
    jest.mocked(mediaFolder).mockResolvedValue('u');
    jest.mocked(usedMediaPaths).mockResolvedValue(['u/used.webp', 'u/used-sm.webp']);
    jest.mocked(listMedia).mockResolvedValue([
      { path: 'u/used.webp', createdAt: '2026-10-01T00:00:00Z' },
      { path: 'u/used-sm.webp', createdAt: '2026-10-01T00:00:00Z' },
      { path: 'u/old.webp', createdAt: '2026-10-11T10:00:00Z' },
      { path: 'u/new.webp', createdAt: '2026-10-11T11:30:00Z' },
      { path: 'u/unknown.webp', createdAt: '' },
    ]);
    expect(await cleanUnusedMedia(now)).toBe(1);
    expect(removeMedia).toHaveBeenCalledWith(['u/old.webp']);
  });
});
