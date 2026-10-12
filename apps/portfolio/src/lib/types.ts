/**
 * The published portfolio, as `portfolio_public` / `portfolio_preview` return it
 * (built on the server from the dashboard's content). Everything here is shown to the
 * public, so it is parsed defensively: unknown shapes become empty values, links must
 * be https or mailto, and image paths must look like the dashboard's uploads.
 */
export type SectionKey =
  'about' | 'skills' | 'projects' | 'experience' | 'education' | 'beyond' | 'contact';

export type Media = {
  path: string;
  small: string | null;
  width: number;
  height: number;
  alt: string;
};
export type FileRef = { path: string; name: string; size: number };

export type Profile = {
  handle: string;
  siteUrl: string | null;
  name: string;
  title: string;
  headline: string;
  rotatingWords: string[];
  intro: string;
  about: string;
  location: string;
  timezone: string;
  email: string;
  availability: 'open' | 'busy' | 'hidden';
  availabilityNote: string;
  avatar: Media | null;
  resume: FileRef | null;
  ogImage: Media | null;
  seoTitle: string;
  seoDescription: string;
  hiddenSections: SectionKey[];
};

export type SocialLink = { id: string; kind: string; label: string; url: string; draft: boolean };
export type Fact = {
  id: string;
  kind: 'stat' | 'highlight' | 'milestone';
  label: string;
  detail: string;
  value: number | null;
  suffix: string;
  when: string;
  draft: boolean;
};
export type Skill = {
  id: string;
  name: string;
  icon: string;
  level: number | null;
  description: string;
  featured: boolean;
  draft: boolean;
};
export type SkillGroup = {
  id: string;
  name: string;
  description: string;
  skills: Skill[];
  draft: boolean;
};
export type GalleryItem = Media & { caption: string; kind: 'screenshot' | 'diagram' };
export type ProjectStatus = 'live' | 'in_progress' | 'completed' | 'archived' | 'concept';
export type Accent = 'ember' | 'ion' | 'lime' | 'violet' | 'rose' | 'sand';
export type Project = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  body: string;
  category: string;
  status: ProjectStatus;
  role: string;
  period: string;
  tech: string[];
  features: string[];
  challenges: string;
  architecture: string;
  repoUrl: string | null;
  liveUrl: string | null;
  docsUrl: string | null;
  cover: Media | null;
  gallery: GalleryItem[];
  featured: boolean;
  accent: Accent;
  draft: boolean;
};
export type Experience = {
  id: string;
  company: string;
  client: string;
  role: string;
  location: string;
  employmentType: string;
  start: string;
  end: string | null;
  summary: string;
  responsibilities: string[];
  achievements: string[];
  tech: string[];
  highlights: string[];
  draft: boolean;
};
export type Credential = {
  id: string;
  kind: 'degree' | 'certification' | 'course' | 'award';
  title: string;
  issuer: string;
  start: string | null;
  end: string | null;
  issued: string | null;
  expires: string | null;
  url: string | null;
  grade: string;
  description: string;
  image: Media | null;
  draft: boolean;
};
export type ExtraItem = { title: string; detail: string; url: string | null };
export type ExtraSection = {
  id: string;
  kind: string;
  title: string;
  body: string;
  items: ExtraItem[];
  draft: boolean;
};

export type PortfolioDocument = {
  profile: Profile;
  links: SocialLink[];
  facts: Fact[];
  skillGroups: SkillGroup[];
  projects: Project[];
  experience: Experience[];
  education: Credential[];
  sections: ExtraSection[];
  version: number | null;
  publishedAt: string | null;
  preview: boolean;
  previewExpiresAt: string | null;
};
