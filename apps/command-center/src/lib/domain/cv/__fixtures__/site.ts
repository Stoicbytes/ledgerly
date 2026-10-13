import { emptySiteData, type Row, type SiteData } from '../../site';

/** A made-up developer's portfolio, complete enough to score well. */
export function fixtureSite(): SiteData {
  const site = emptySiteData();
  const row = (id: string, values: Record<string, unknown>, order = 0) =>
    ({ id, sort_order: order, visible: true, ...values }) as Row;
  site.profile = row('profile', {
    full_name: 'Asha Kumar',
    title: 'Senior Full-Stack Engineer',
    headline: 'I build calm, fast finance apps.',
    intro:
      'Full-stack engineer with **8 years** building web and mobile products in TypeScript, ' +
      'React and PostgreSQL. I lead small teams, ship reliable releases every week and care ' +
      'about performance, accessibility and clear code. Recently cut page load times by 40% ' +
      'for a fintech app used by 200k people.',
    public_email: 'asha@example.com',
    location: 'Chennai, India',
  });
  site.rows.link = [
    row('l1', { kind: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/asha/' }),
    row('l2', { kind: 'github', label: 'GitHub', url: 'https://github.com/asha' }, 1),
    row('l3', { kind: 'x', label: 'X', url: 'https://x.com/asha' }, 2),
  ];
  site.rows.skill_group = [row('g1', { name: 'Frontend' }), row('g2', { name: 'Backend' }, 1)];
  const skills = [
    ['TypeScript', 'g1'],
    ['React', 'g1'],
    ['React Native', 'g1'],
    ['Next.js', 'g1'],
    ['Node.js', 'g2'],
    ['PostgreSQL', 'g2'],
    ['Supabase', 'g2'],
    ['AWS', 'g2'],
    ['Docker', 'g3'],
  ];
  site.rows.skill = skills.map(([name, group], i) => row(`s${i}`, { name, group_id: group }, i));
  site.rows.experience = [
    row('e1', {
      role: 'Software Engineer',
      company: 'Old Co',
      started_on: '2017-06-01',
      ended_on: '2021-12-31',
      highlights: ['Built 12 internal tools with React', 'Reduced build time by 50%'],
      achievements: ['Mentored 4 junior engineers'],
      tech: ['React', 'Java'],
    }),
    row('e2', {
      role: 'Senior Engineer',
      company: 'Fintech Ltd',
      client: 'Big Bank',
      location: 'Remote',
      started_on: '2022-01-10',
      highlights: ['Led a team of 5 to rebuild the payments app', 'Cut load time by 40%'],
      achievements: ['Raised test coverage from 40% to 85%'],
      responsibilities: ['Designed APIs in Node.js and PostgreSQL', 'Reviewed code daily'],
      tech: ['TypeScript', 'React Native', 'PostgreSQL'],
    }),
    row('e3', { role: 'Hidden role', company: 'X', started_on: '2015-01-01', visible: false }),
  ];
  site.rows.project = [
    row('p1', {
      title: 'Ledger app',
      tagline: 'Personal finance on web and phones',
      role: 'Solo developer',
      repo_url: 'https://github.com/asha/ledger',
      period: '2025',
      features: ['Built offline sync for 5 data types', 'Shipped to 3 platforms'],
      tech: ['Expo', 'Supabase'],
      featured: true,
    }),
  ];
  site.rows.education = [
    row('d1', {
      kind: 'degree',
      title: 'B.E. Computer Science',
      issuer: 'Anna University',
      started_on: '2013-06-01',
      ended_on: '2017-05-01',
      grade: '8.4 CGPA',
    }),
    row('c1', {
      kind: 'certification',
      title: 'AWS Developer',
      issuer: 'AWS',
      issued_on: '2023-03-01',
    }),
  ];
  return site;
}
