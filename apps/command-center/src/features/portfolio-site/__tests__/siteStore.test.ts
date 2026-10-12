import * as repo from '@/lib/data/siteRepository';
import { formValues } from '@/lib/domain/site';
import { cleanUnusedMedia } from '../state/siteMedia';
import { useSiteStore } from '../state/siteStore';

jest.mock('@/lib/data/siteRepository');
jest.mock('../state/siteMedia');

const mocked = repo as jest.Mocked<typeof repo>;
const empty = {
  profile: null,
  messages: [],
  publication: { handle: 'sam', version: 2, publishedAt: '2026-10-01T00:00:00Z', dirty: false },
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(cleanUnusedMedia).mockResolvedValue(0);
  mocked.loadSite.mockResolvedValue({
    ...empty,
    rows: {
      link: [],
      fact: [],
      project: [],
      experience: [],
      education: [],
      section: [],
      skill_group: [{ id: 'g1', name: 'Backend', sort_order: 0, visible: true }],
      skill: [
        { id: 's1', group_id: 'g1', name: 'Java', sort_order: 0, visible: true },
        { id: 's2', group_id: 'g1', name: 'SQL', sort_order: 1, visible: true },
      ],
    },
  });
});

describe('portfolio store (signed in)', () => {
  it('saves through the database and marks the site as having unpublished changes', async () => {
    await useSiteStore.getState().start('cloud');
    mocked.saveSiteItem.mockResolvedValue({
      id: 'p1',
      slug: 'app',
      title: 'App',
      sort_order: 0,
      visible: true,
    });
    await useSiteStore.getState().save('project', {
      ...formValues('project', null),
      title: 'App',
      slug: 'app',
    });
    expect(mocked.saveSiteItem).toHaveBeenCalledWith(
      'project',
      expect.objectContaining({ title: 'App', slug: 'app', visible: true }),
    );
    expect(useSiteStore.getState().rows.project.map((r) => r.id)).toEqual(['p1']);
    expect(useSiteStore.getState().publication?.dirty).toBe(true);
  });

  it('reorders within a skill area and deletes an area with its skills', async () => {
    await useSiteStore.getState().start('cloud');
    await useSiteStore.getState().move('skill', 's2', -1);
    expect(mocked.reorderSiteItems).toHaveBeenCalledWith('skill', ['s2', 's1']);
    await useSiteStore.getState().remove('skill_group', 'g1');
    expect(mocked.deleteSiteItem).toHaveBeenCalledWith('skill_group', 'g1');
    expect(useSiteStore.getState().rows.skill).toEqual([]);
  });

  it('publishes and records the new version', async () => {
    await useSiteStore.getState().start('cloud');
    mocked.publishSite.mockResolvedValue({
      handle: 'sam',
      version: 3,
      publishedAt: '2026-10-11T00:00:00Z',
      dirty: false,
    });
    await useSiteStore.getState().publish();
    expect(useSiteStore.getState().publication).toMatchObject({ version: 3, dirty: false });
    expect(cleanUnusedMedia).toHaveBeenCalled();
  });

  it('shows a failure when loading does not work', async () => {
    mocked.loadSite.mockRejectedValue(new Error('down'));
    await useSiteStore.getState().start('cloud');
    expect(useSiteStore.getState().status).toBe('failed');
  });

  it('never publishes sample content', async () => {
    await useSiteStore.getState().start('preview');
    await expect(useSiteStore.getState().publish()).rejects.toThrow();
    expect(mocked.publishSite).not.toHaveBeenCalled();
  });
});
