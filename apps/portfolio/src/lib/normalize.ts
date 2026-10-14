import { arr, bool, file, list, media, num, obj, oneOf, safeUrl, str, strOrNull } from './parse';
import { credential, experience, fact, group, link, project, section } from './normalizeItems';
import type { PortfolioDocument, Profile, SectionKey } from './types';

const SECTIONS: readonly SectionKey[] = [
  'about',
  'skills',
  'projects',
  'experience',
  'education',
  'beyond',
  'contact',
];

function profile(v: unknown): Profile {
  const p = obj(v);
  return {
    handle: str(p.handle, 40),
    siteUrl: safeUrl(p.siteUrl),
    name: str(p.name, 80),
    title: str(p.title, 120),
    headline: str(p.headline, 160),
    rotatingWords: list(p.rotatingWords, 8),
    intro: str(p.intro, 600),
    about: str(p.about, 6000),
    location: str(p.location, 80),
    timezone: /^[A-Za-z]+(\/[A-Za-z0-9_+-]+){1,2}$/.test(str(p.timezone)) ? str(p.timezone) : '',
    email: /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,63}$/.test(
      str(p.email, 254),
    )
      ? str(p.email)
      : '',
    availability: oneOf(p.availability, ['open', 'busy', 'hidden'] as const, 'hidden'),
    availabilityNote: str(p.availabilityNote, 80),
    avatar: media(p.avatar),
    resume: file(p.resume),
    ogImage: media(p.ogImage),
    seoTitle: str(p.seoTitle, 70),
    seoDescription: str(p.seoDescription, 200),
    hiddenSections: arr(p.hiddenSections).filter((s): s is SectionKey =>
      SECTIONS.includes(s as SectionKey),
    ),
  };
}

function present<T>(items: (T | null)[]): T[] {
  return items.filter((item): item is T => item !== null);
}

/** Parses an untrusted document; null when it has no profile with a name. */
export function normalizeDocument(raw: unknown): PortfolioDocument | null {
  const d = obj(raw);
  const p = profile(d.profile);
  if (!p.name) return null;
  return {
    profile: p,
    links: present(arr(d.links).map(link)),
    facts: present(arr(d.facts).map(fact)),
    skillGroups: present(arr(d.skillGroups).map(group)),
    projects: present(arr(d.projects).map(project)),
    experience: present(arr(d.experience).map(experience)),
    education: present(arr(d.education).map(credential)),
    sections: present(arr(d.sections).map(section)),
    version: num(d.version),
    publishedAt: strOrNull(d.publishedAt),
    preview: bool(d.preview),
    previewExpiresAt: strOrNull(d.previewExpiresAt),
  };
}
