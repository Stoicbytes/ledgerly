import { ordered, type Row, type SiteData } from '../site';
import { dateRange, displayUrl, firstSentences, monthYear, plainText, unique } from './text';
import type { Cv, CvEntry, CvSkillGroup } from './types';

export type CvOptions = {
  /** Typed when downloading; never saved (the portfolio keeps no phone number). */
  phone?: string;
  /** The public portfolio's address, added to the contact line. */
  siteUrl?: string;
};

/** How much goes in, to keep the CV to one or two pages. */
const LIMITS = { summaryWords: 80, roleBullets: 6, latestRoleBullets: 8, projects: 4 } as const;
const PROFILE_LINKS = ['linkedin', 'github', 'website', 'stackoverflow', 'medium', 'devto'];

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const list = (value: unknown) => (Array.isArray(value) ? (value as unknown[]) : []);
const shown = (rows: Row[]) => ordered(rows).filter((row) => row.visible !== false);
const join = (parts: unknown[], separator = ', ') => unique(parts).join(separator);

function contact(site: SiteData, options: CvOptions): string[] {
  const profile = site.profile ?? ({} as Row);
  const links = shown(site.rows.link);
  const email =
    text(profile.public_email) ||
    displayUrl(text(links.find((link) => link.kind === 'email')?.url));
  const profiles = PROFILE_LINKS.flatMap((kind) =>
    links.filter((link) => link.kind === kind).map((link) => displayUrl(text(link.url))),
  );
  const site_ = options.siteUrl ? displayUrl(options.siteUrl) : '';
  return unique([email, options.phone, text(profile.location), ...profiles, site_]);
}

function summary(profile: Row | null): string {
  const intro = plainText(text(profile?.intro));
  const about = plainText(text(profile?.about));
  const source = intro || about || text(profile?.headline);
  return firstSentences(source, LIMITS.summaryWords);
}

function skills(site: SiteData): CvSkillGroup[] {
  const all = shown(site.rows.skill);
  const groups = shown(site.rows.skill_group)
    .map((group) => ({
      label: text(group.name),
      items: unique(all.filter((skill) => skill.group_id === group.id).map((skill) => skill.name)),
    }))
    .filter((group) => group.label && group.items.length);
  const grouped = new Set(groups.flatMap((group) => group.items.map((item) => item.toLowerCase())));
  const rest = unique(all.map((skill) => skill.name)).filter(
    (name) => !grouped.has(name.toLowerCase()),
  );
  return rest.length
    ? [...groups, { label: groups.length ? 'Other' : 'Skills', items: rest }]
    : groups;
}

function experience(rows: Row[]): CvEntry[] {
  return shown(rows)
    .sort((a, b) => text(b.started_on).localeCompare(text(a.started_on)))
    .map((row, index) => {
      const bullets = unique([
        ...list(row.highlights),
        ...list(row.achievements),
        ...list(row.responsibilities),
      ]);
      const fallback = bullets.length ? [] : [firstSentences(plainText(text(row.summary)), 60)];
      const where = join([row.company, row.client ? `Client: ${text(row.client)}` : '']);
      return {
        heading: text(row.role),
        subheading: join([where, row.location], ' | '),
        dates: dateRange(row.started_on, row.ended_on),
        bullets: unique([...bullets, ...fallback]).slice(
          0,
          index === 0 ? LIMITS.latestRoleBullets : LIMITS.roleBullets,
        ),
        line: list(row.tech).length ? `Technologies: ${join(list(row.tech))}` : '',
      };
    });
}

function projects(rows: Row[]): CvEntry[] {
  return shown(rows)
    .sort((a, b) => Number(b.featured === true) - Number(a.featured === true))
    .slice(0, LIMITS.projects)
    .map((row) => {
      const link = text(row.live_url) || text(row.repo_url);
      const about = text(row.tagline) || firstSentences(plainText(text(row.summary)), 30);
      return {
        heading: text(row.title),
        subheading: join([row.role, link ? displayUrl(link) : ''], ' | '),
        dates: text(row.period),
        bullets: unique([about, ...list(row.features).slice(0, 3)]),
        line: list(row.tech).length ? `Technologies: ${join(list(row.tech))}` : '',
      };
    });
}

function credential(row: Row): CvEntry {
  const degree = row.kind === 'degree' || row.kind === 'course';
  const dates = degree ? dateRange(row.started_on, row.ended_on, '') : monthYear(row.issued_on);
  return {
    heading: text(row.title),
    subheading: join([row.issuer, row.grade ? `Grade: ${text(row.grade)}` : ''], ' | '),
    dates,
    bullets: unique([firstSentences(text(row.description), 40)]),
    line: '',
  };
}

/** The CV, from the portfolio's visible items, newest roles first. */
export function buildCv(site: SiteData, options: CvOptions = {}): Cv {
  const profile = site.profile;
  const credentials = shown(site.rows.education);
  return {
    name: text(profile?.full_name),
    title: text(profile?.title) || text(profile?.headline),
    contact: contact(site, options),
    summary: summary(profile),
    skills: skills(site),
    experience: experience(site.rows.experience),
    projects: projects(site.rows.project),
    education: credentials.filter((row) => row.kind === 'degree').map(credential),
    certifications: credentials.filter((row) => row.kind !== 'degree').map(credential),
  };
}

/** "Firstname-Lastname-CV.pdf" (letters, digits and dashes only), or "CV.pdf" without a name. */
export function cvFileName(cv: Cv, extension: 'pdf' | 'docx'): string {
  const base = cv.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return base ? `${base}-CV.${extension}` : `CV.${extension}`;
}
