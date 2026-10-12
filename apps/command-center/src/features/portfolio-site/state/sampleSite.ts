import { emptySiteData, type Row, type SiteData } from '@/lib/domain/site';

/**
 * Labelled sample content for preview mode (no Supabase project configured): a fictional
 * developer, so the editor can be tried without an account. It is never saved.
 */
const row = (id: string, sort: number, values: Record<string, unknown>): Row =>
  ({ id, sort_order: sort, visible: true, ...values }) as Row;

export function sampleSite(): SiteData {
  const data = emptySiteData();
  data.profile = row('profile', 0, {
    handle: 'sample-dev',
    site_url: null,
    full_name: 'Sample Developer',
    title: 'Full-Stack Developer',
    headline: 'I build dependable services and calm interfaces.',
    rotating_words: ['APIs', 'design systems'],
    intro: 'Sample text for the preview. Sign in to edit your own portfolio.',
    about: 'This is **sample** content shown in preview mode.',
    location: 'Sample City',
    timezone: 'Asia/Kolkata',
    public_email: '',
    availability: 'open',
    availability_note: '',
    avatar: null,
    resume: null,
    og_image: null,
    seo_title: '',
    seo_description: '',
    hidden_sections: [],
  });
  data.rows.link = [
    row('l1', 0, { kind: 'github', label: 'GitHub', url: 'https://github.com/example' }),
  ];
  data.rows.fact = [
    row('f1', 0, {
      kind: 'stat',
      label: 'Years building',
      value: 3,
      suffix: '+',
      detail: '',
      when_label: '',
    }),
    row('f2', 1, {
      kind: 'highlight',
      label: 'Design systems',
      detail: 'Sample highlight.',
      value: null,
      suffix: '',
      when_label: '',
    }),
  ];
  data.rows.skill_group = [
    row('g1', 0, { name: 'Backend', description: '' }),
    row('g2', 1, { name: 'Frontend', description: '' }),
  ];
  data.rows.skill = [
    row('s1', 0, {
      group_id: 'g1',
      name: 'Java',
      icon: 'code-xml',
      level: null,
      description: '',
      featured: true,
    }),
    row('s2', 1, {
      group_id: 'g1',
      name: 'PostgreSQL',
      icon: 'database',
      level: null,
      description: '',
      featured: false,
    }),
    row('s3', 0, {
      group_id: 'g2',
      name: 'Angular',
      icon: 'layout-dashboard',
      level: null,
      description: '',
      featured: true,
    }),
  ];
  data.rows.project = [
    row('p1', 0, {
      slug: 'sample-project',
      title: 'Sample project',
      tagline: 'A sample project for the preview.',
      summary: '',
      body: '',
      category: 'Full-stack',
      status: 'live',
      role: '',
      period: '2026',
      tech: ['TypeScript', 'PostgreSQL'],
      features: [],
      challenges: '',
      architecture: '',
      repo_url: null,
      live_url: null,
      docs_url: null,
      cover: null,
      gallery: [],
      featured: true,
      accent: 'ember',
    }),
  ];
  data.rows.experience = [
    row('e1', 0, {
      company: 'Example Ltd',
      client: '',
      role: 'Software Engineer',
      location: '',
      employment_type: '',
      started_on: '2024-01-15',
      ended_on: null,
      summary: '',
      responsibilities: ['Sample responsibility.'],
      highlights: [],
      achievements: [],
      tech: ['Java'],
    }),
  ];
  data.rows.education = [
    row('d1', 0, {
      kind: 'certification',
      title: 'Sample Certificate',
      issuer: 'Example Academy',
      issued_on: '2025-03-01',
    }),
  ];
  data.messages = [
    {
      id: 'm1',
      name: 'Sample Visitor',
      email: 'visitor@example.com',
      message: 'A sample message from the contact form.',
      createdAt: '2026-10-01T09:30:00Z',
      readAt: null,
    },
  ];
  return data;
}
