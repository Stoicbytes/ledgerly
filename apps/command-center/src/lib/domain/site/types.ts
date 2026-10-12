/**
 * The public portfolio's content as the dashboard edits it (migration 0010). Rows keep
 * the database's column names, so the field definitions, the checks and the saved
 * payload all use one vocabulary. The public site reads a separate published copy.
 */
export type SiteKind =
  'link' | 'fact' | 'skill_group' | 'skill' | 'project' | 'experience' | 'education' | 'section';
export type EditKind = SiteKind | 'profile';

export const SITE_KINDS: readonly SiteKind[] = [
  'link',
  'fact',
  'skill_group',
  'skill',
  'project',
  'experience',
  'education',
  'section',
];

export type Media = {
  path: string;
  small: string | null;
  width: number;
  height: number;
  alt: string;
};
export type FileRef = { path: string; name: string; size: number };
export type GalleryItem = Media & { caption: string; kind: 'screenshot' | 'diagram' };
export type SectionItem = { title: string; detail: string; url: string };

export type FieldValue =
  string | number | boolean | null | string[] | Media | FileRef | GalleryItem[] | SectionItem[];

/** One row: database column → value. Every item has an id, order and visibility. */
export type Row = Record<string, FieldValue> & { id: string };
export type Values = Record<string, FieldValue>;

export type Publication = {
  handle: string;
  version: number;
  publishedAt: string;
  /** The working copy differs from what visitors see. */
  dirty: boolean;
};

export type SiteMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};

export type SiteData = {
  profile: Row | null;
  rows: Record<SiteKind, Row[]>;
  messages: SiteMessage[];
  publication: Publication | null;
};

export const emptySiteData = (): SiteData => ({
  profile: null,
  rows: {
    link: [],
    fact: [],
    skill_group: [],
    skill: [],
    project: [],
    experience: [],
    education: [],
    section: [],
  },
  messages: [],
  publication: null,
});

/** Home-page sections that can be hidden (profile.hidden_sections). */
export const SECTION_KEYS = [
  ['projects', 'Work'],
  ['skills', 'Stack'],
  ['experience', 'Experience'],
  ['about', 'About'],
  ['education', 'Credentials'],
  ['beyond', 'Beyond the code'],
  ['contact', 'Contact form'],
] as const;

/** Icons a skill can use (the public site draws the same set). */
export const SKILL_ICONS = [
  'code-xml',
  'braces',
  'terminal',
  'server',
  'network',
  'database',
  'cloud',
  'container',
  'layout-dashboard',
  'layers',
  'palette',
  'smartphone',
  'globe',
  'git-branch',
  'workflow',
  'box',
  'gauge',
  'chart-line',
  'shield-check',
  'flask-conical',
  'cpu',
  'bot',
  'brain-circuit',
  'sparkles',
] as const;
