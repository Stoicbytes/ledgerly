import { formValues, moved, rowSummary, savePayload, slugify, validateValues, type Row } from '..';

const project = (id: string, slug: string, sort: number): Row =>
  ({ id, slug, title: slug, sort_order: sort, visible: true }) as Row;

describe('portfolio content rules', () => {
  it('fills every field of a new item with the database defaults', () => {
    const values = formValues('project', null);
    expect(values).toMatchObject({
      status: 'completed',
      accent: 'ember',
      tech: [],
      visible: true,
      cover: null,
      repo_url: '',
    });
    expect(formValues('fact', null).kind).toBe('stat');
  });

  it('sends trimmed values, empty links and dates as null, and clears hidden fields', () => {
    const payload = savePayload(
      'fact',
      {
        kind: 'highlight',
        label: '  Shipped  ',
        value: 5,
        suffix: '+',
        detail: 'x',
        when_label: 'May',
        visible: true,
      },
      'f1',
    );
    expect(payload).toEqual({
      id: 'f1',
      kind: 'highlight',
      label: 'Shipped',
      value: null,
      suffix: '',
      when_label: '',
      detail: 'x',
      visible: true,
    });
    const job = savePayload('experience', {
      ...formValues('experience', null),
      role: 'Dev',
      company: 'Co',
      started_on: '2024-01-01',
      ended_on: '',
      tech: [' Java', '', 'SQL '],
    });
    expect(job.ended_on).toBeNull();
    expect(job.tech).toEqual(['Java', 'SQL']);
    expect(
      savePayload('project', { ...formValues('project', null), repo_url: '' }).repo_url,
    ).toBeNull();
    expect(
      savePayload('profile', { ...formValues('profile', null), handle: '' }).handle,
    ).toBeNull();
  });

  it('checks what the database checks', () => {
    const base = { ...formValues('project', null), title: 'App', slug: 'app' };
    expect(validateValues('project', base)).toEqual({});
    expect(validateValues('project', { ...base, title: '' }).title).toBe('Title is needed.');
    expect(validateValues('project', { ...base, slug: 'Bad Slug' }).slug).toMatch(/Lowercase/);
    expect(
      validateValues('project', { ...base, repo_url: 'javascript:alert(1)' }).repo_url,
    ).toMatch(/https/);
    expect(
      validateValues('project', { ...base, live_url: 'http://plain.example' }).live_url,
    ).toMatch(/https/);
    expect(validateValues('project', base, [project('p2', 'app', 0)], 'p1').slug).toMatch(
      /already/,
    );
    expect(validateValues('project', base, [project('p1', 'app', 0)], 'p1')).toEqual({});
    expect(
      validateValues('project', {
        ...base,
        cover: { path: 'a', small: null, width: 1, height: 1, alt: ' ' },
      }).cover,
    ).toMatch(/Describe/);
    expect(validateValues('fact', { ...formValues('fact', null), label: 'Years' }).value).toBe(
      'Number is needed.',
    );
    expect(
      validateValues('experience', {
        ...formValues('experience', null),
        role: 'r',
        company: 'c',
        started_on: '2025-01-01',
        ended_on: '2024-01-01',
      }).ended_on,
    ).toMatch(/before/);
    expect(
      validateValues('profile', { ...formValues('profile', null), full_name: 'A', handle: 'ab' })
        .handle,
    ).toMatch(/3 to 40/);
    expect(
      validateValues('link', { kind: 'email', label: 'Mail', url: 'mailto:a@b.co', visible: true }),
    ).toEqual({});
  });

  it('makes page addresses and reorders', () => {
    expect(slugify('  Café — My First App! ')).toBe('cafe-my-first-app');
    const rows = [project('a', 'a', 0), project('b', 'b', 1), project('c', 'c', 2)];
    expect(moved(rows, 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moved(rows, 'a', -1)).toBeNull();
  });

  it('summarises rows for the lists', () => {
    expect(
      rowSummary('fact', { id: 'f', kind: 'stat', label: 'Years', value: 2.5, suffix: '+' } as Row)
        .title,
    ).toBe('2.5+ Years');
    expect(
      rowSummary('experience', {
        id: 'e',
        role: 'Dev',
        company: 'Co',
        client: '',
        started_on: '2024-05-30',
        ended_on: null,
      } as Row),
    ).toEqual({
      title: 'Dev · Co',
      detail: '2024-05-30 – now',
    });
  });
});
