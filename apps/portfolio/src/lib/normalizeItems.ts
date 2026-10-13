import { arr, bool, date, list, media, num, obj, oneOf, safeUrl, str } from './parse';
import type {
  Accent,
  Credential,
  Experience,
  ExtraSection,
  Fact,
  GalleryItem,
  Project,
  ProjectStatus,
  Skill,
  SkillGroup,
  SocialLink,
} from './types';

/** Readers for each kind of item in the published document (see normalize.ts). */
const id = (v: unknown, index: number) => str(v, 64) || `item-${index}`;

export function link(v: unknown, i: number): SocialLink | null {
  const l = obj(v);
  const url = safeUrl(l.url);
  return url
    ? { id: id(l.id, i), kind: str(l.kind, 20), label: str(l.label, 40), url, draft: bool(l.draft) }
    : null;
}

export function fact(v: unknown, i: number): Fact | null {
  const f = obj(v);
  const kind = oneOf(f.kind, ['stat', 'highlight', 'milestone'] as const, 'highlight');
  const label = str(f.label, 80);
  const value = typeof f.value === 'string' ? Number(f.value) : num(f.value);
  if (!label || (kind === 'stat' && (value === null || !Number.isFinite(value)))) return null;
  return {
    id: id(f.id, i),
    kind,
    label,
    detail: str(f.detail, 400),
    value: value !== null && Number.isFinite(value) ? value : null,
    suffix: str(f.suffix, 12),
    when: str(f.when, 40),
    draft: bool(f.draft),
  };
}

function skill(v: unknown, i: number): Skill | null {
  const s = obj(v);
  const name = str(s.name, 60);
  const level = num(s.level);
  return name
    ? {
        id: id(s.id, i),
        name,
        icon: /^[a-z0-9-]{1,30}$/.test(str(s.icon)) ? str(s.icon) : '',
        level: level && level >= 1 && level <= 5 ? Math.round(level) : null,
        description: str(s.description, 300),
        featured: bool(s.featured),
        draft: bool(s.draft),
      }
    : null;
}

export function group(v: unknown, i: number): SkillGroup | null {
  const g = obj(v);
  const name = str(g.name, 60);
  return name
    ? {
        id: id(g.id, i),
        name,
        description: str(g.description, 300),
        skills: arr(g.skills)
          .map(skill)
          .filter((s): s is Skill => s !== null),
        draft: bool(g.draft),
      }
    : null;
}

const STATUSES: readonly ProjectStatus[] = [
  'live',
  'in_progress',
  'completed',
  'archived',
  'concept',
];
const ACCENTS: readonly Accent[] = ['ember', 'ion', 'lime', 'violet', 'rose', 'sand'];

function galleryItem(v: unknown): GalleryItem | null {
  const g = obj(v);
  const m = media(g);
  return m
    ? {
        ...m,
        caption: str(g.caption, 200),
        kind: oneOf(g.kind, ['screenshot', 'diagram'] as const, 'screenshot'),
      }
    : null;
}

export function project(v: unknown, i: number): Project | null {
  const p = obj(v);
  const slug = str(p.slug, 60);
  const title = str(p.title, 100);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !title) return null;
  return {
    id: id(p.id, i),
    slug,
    title,
    tagline: str(p.tagline, 160),
    summary: str(p.summary, 600),
    body: str(p.body, 12000),
    category: str(p.category, 40),
    status: oneOf(p.status, STATUSES, 'completed'),
    role: str(p.role, 80),
    period: str(p.period, 40),
    tech: list(p.tech, 24),
    features: list(p.features, 12),
    challenges: str(p.challenges, 6000),
    architecture: str(p.architecture, 6000),
    repoUrl: safeUrl(p.repoUrl),
    liveUrl: safeUrl(p.liveUrl),
    docsUrl: safeUrl(p.docsUrl),
    cover: media(p.cover),
    gallery: arr(p.gallery)
      .map(galleryItem)
      .filter((g): g is GalleryItem => g !== null)
      .slice(0, 12),
    featured: bool(p.featured),
    accent: oneOf(p.accent, ACCENTS, 'ember'),
    draft: bool(p.draft),
  };
}

export function experience(v: unknown, i: number): Experience | null {
  const e = obj(v);
  const start = date(e.start);
  const company = str(e.company, 100);
  const role = str(e.role, 100);
  if (!start || !company || !role) return null;
  return {
    id: id(e.id, i),
    company,
    client: str(e.client, 100),
    role,
    location: str(e.location, 80),
    employmentType: str(e.employmentType, 40),
    start,
    end: date(e.end),
    summary: str(e.summary, 2000),
    responsibilities: list(e.responsibilities, 12),
    achievements: list(e.achievements, 8),
    tech: list(e.tech, 24),
    highlights: list(e.highlights, 8),
    draft: bool(e.draft),
  };
}

export function credential(v: unknown, i: number): Credential | null {
  const c = obj(v);
  const title = str(c.title, 140);
  return title
    ? {
        id: id(c.id, i),
        kind: oneOf(
          c.kind,
          ['degree', 'certification', 'course', 'award'] as const,
          'certification',
        ),
        title,
        issuer: str(c.issuer, 120),
        start: date(c.start),
        end: date(c.end),
        issued: date(c.issued),
        expires: date(c.expires),
        url: safeUrl(c.url),
        grade: str(c.grade, 40),
        description: str(c.description, 1000),
        image: media(c.image),
        draft: bool(c.draft),
      }
    : null;
}

export function section(v: unknown, i: number): ExtraSection | null {
  const s = obj(v);
  const title = str(s.title, 80);
  return title
    ? {
        id: id(s.id, i),
        kind: str(s.kind, 20),
        title,
        body: str(s.body, 4000),
        items: arr(s.items)
          .map((item) => {
            const it = obj(item);
            const itemTitle = str(it.title, 80);
            return itemTitle
              ? { title: itemTitle, detail: str(it.detail, 300), url: safeUrl(it.url) }
              : null;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .slice(0, 12),
        draft: bool(s.draft),
      }
    : null;
}
