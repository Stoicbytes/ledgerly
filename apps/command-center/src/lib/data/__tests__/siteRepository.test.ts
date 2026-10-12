import { siteFromRemote } from '../siteRepository';

describe('portfolio rows from the database', () => {
  it('maps lists, messages and the publication, ignoring malformed rows', () => {
    const data = siteFromRemote({
      profile: { id: 'p', full_name: 'Sam' },
      projects: [{ id: 'x', slug: 'a', title: 'A' }, { nope: true }, 'junk'],
      skill_groups: [{ id: 'g', name: 'Backend' }],
      messages: [
        {
          id: 'm',
          name: 'V',
          email: 'v@x.co',
          message: 'Hi',
          created_at: '2026-10-01T00:00:00Z',
          read_at: null,
        },
      ],
      publication: { handle: 'sam', version: 4, published_at: '2026-10-02T00:00:00Z', dirty: true },
    });
    expect(data.profile?.full_name).toBe('Sam');
    expect(data.rows.project.map((row) => row.id)).toEqual(['x']);
    expect(data.rows.skill_group).toHaveLength(1);
    expect(data.rows.link).toEqual([]);
    expect(data.messages[0]).toEqual({
      id: 'm',
      name: 'V',
      email: 'v@x.co',
      message: 'Hi',
      createdAt: '2026-10-01T00:00:00Z',
      readAt: null,
    });
    expect(data.publication).toEqual({
      handle: 'sam',
      version: 4,
      publishedAt: '2026-10-02T00:00:00Z',
      dirty: true,
    });
  });

  it('treats a missing reply as an empty portfolio', () => {
    expect(siteFromRemote(null).profile).toBeNull();
    expect(siteFromRemote({ publication: null }).publication).toBeNull();
  });
});
