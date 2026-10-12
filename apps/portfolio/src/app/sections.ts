import { SECTION_IDS } from '../lib/routes';
import type { PortfolioDocument, SectionKey } from '../lib/types';

/**
 * Which home-page sections appear, in order. A section shows when it has content and
 * you have not hidden it in the dashboard, so an empty section never leaves a gap.
 */
export type SectionInfo = { key: SectionKey; id: string; label: string };

const LABELS: Record<SectionKey, string> = {
  projects: 'Work',
  skills: 'Stack',
  experience: 'Experience',
  about: 'About',
  education: 'Credentials',
  beyond: 'Beyond',
  contact: 'Contact',
};

const ORDER: SectionKey[] = [
  'projects',
  'skills',
  'experience',
  'about',
  'education',
  'beyond',
  'contact',
];

function hasContent(document: PortfolioDocument, key: SectionKey): boolean {
  switch (key) {
    case 'projects':
      return document.projects.length > 0;
    case 'skills':
      return document.skillGroups.some((group) => group.skills.length > 0);
    case 'experience':
      return document.experience.length > 0;
    case 'about': {
      const { about, avatar, resume } = document.profile;
      return (
        Boolean(about.trim() || avatar || resume) || document.facts.some((f) => f.kind !== 'stat')
      );
    }
    case 'education':
      return document.education.length > 0;
    case 'beyond':
      return document.sections.length > 0;
    case 'contact':
      return true;
  }
}

export function visibleSections(document: PortfolioDocument): SectionInfo[] {
  const hidden = new Set(document.profile.hiddenSections);
  return ORDER.filter((key) => !hidden.has(key) && hasContent(document, key)).map((key) => ({
    key,
    id: SECTION_IDS[key],
    label: LABELS[key],
  }));
}

/** "Ada Lovelace" → ["Ada", "Lovelace"]: the last word gets the serif accent. */
export function splitName(name: string): [string, string] {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return [name.trim(), ''];
  return [words.slice(0, -1).join(' '), words[words.length - 1] ?? ''];
}

export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return letters
    .map((word) => (word ?? '').charAt(0))
    .join('')
    .toUpperCase();
}
