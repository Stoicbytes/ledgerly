import { mediaUrl, type SiteConfig } from './config';
import { escapeHtml, jsonForScript } from './escape';
import { toPlainText } from './markdown';
import { projectHref, type Route } from './routes';
import type { Media, PortfolioDocument, Project } from './types';

/**
 * Everything search engines and link previews read from the page's <head>: title,
 * description, canonical address, Open Graph and Twitter cards, and schema.org data.
 * Built on the server from the published document, so previews never need JavaScript.
 */
export type HeadInput = {
  document: PortfolioDocument | null;
  route: Route;
  origin: string;
  config: SiteConfig | null;
  /** Previews, drafts, missing pages and unpublished sites are never indexed. */
  noindex: boolean;
};

export function findProject(document: PortfolioDocument | null, route: Route): Project | null {
  return route.name === 'project'
    ? (document?.projects.find((project) => project.slug === route.slug) ?? null)
    : null;
}

export function pageTitle(document: PortfolioDocument | null, route: Route): string {
  if (!document) return route.name === 'preview' ? 'Preview' : 'Portfolio';
  const { name, title, seoTitle } = document.profile;
  const project = findProject(document, route);
  if (project) return `${project.title} — ${name}`;
  if (route.name === 'notFound' || route.name === 'project') return `Page not found — ${name}`;
  return seoTitle || (title ? `${name} — ${title}` : name);
}

function pageDescription(document: PortfolioDocument | null, route: Route): string {
  if (!document) return '';
  const project = findProject(document, route);
  if (project) return project.summary || project.tagline || toPlainText(project.body, 200);
  const { seoDescription, intro, headline } = document.profile;
  return seoDescription || toPlainText(intro, 200) || headline;
}

const meta = (attr: 'name' | 'property', key: string, value: string) =>
  value ? `<meta ${attr}="${key}" content="${escapeHtml(value)}" />` : '';

function shareImage(document: PortfolioDocument, project: Project | null): Media | null {
  return project?.cover ?? document.profile.ogImage ?? document.profile.avatar ?? null;
}

function personData(document: PortfolioDocument, origin: string, config: SiteConfig | null) {
  const { profile } = document;
  const current = document.experience.find((job) => !job.end);
  return {
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.title || undefined,
    description: toPlainText(profile.intro, 300) || undefined,
    url: `${origin}/`,
    image: profile.avatar ? mediaUrl(config, profile.avatar.path) : undefined,
    address: profile.location
      ? { '@type': 'PostalAddress', addressLocality: profile.location }
      : undefined,
    sameAs: document.links.map((link) => link.url).filter((url) => url.startsWith('https://')),
    knowsAbout: document.skillGroups
      .flatMap((group) => group.skills.map((s) => s.name))
      .slice(0, 30),
    worksFor: current ? { '@type': 'Organization', name: current.company } : undefined,
    alumniOf: document.education
      .filter((item) => item.kind === 'degree' && item.issuer)
      .map((item) => ({ '@type': 'CollegeOrUniversity', name: item.issuer })),
  };
}

function structuredData(input: HeadInput, project: Project | null): unknown {
  const { document, origin, config } = input;
  if (!document) return null;
  const person = personData(document, origin, config);
  if (!project) return { '@context': 'https://schema.org', ...person };
  return {
    '@context': 'https://schema.org',
    '@type': project.repoUrl ? 'SoftwareSourceCode' : 'CreativeWork',
    name: project.title,
    description: project.summary || project.tagline || undefined,
    url: `${origin}${projectHref(project.slug)}`,
    image: project.cover ? mediaUrl(config, project.cover.path) : undefined,
    keywords: project.tech.join(', ') || undefined,
    codeRepository: project.repoUrl ?? undefined,
    dateModified: document.publishedAt ?? undefined,
    author: { '@type': 'Person', name: person.name, url: person.url },
  };
}

export function buildHead(input: HeadInput): string {
  const { document, route, origin, config, noindex } = input;
  const project = findProject(document, route);
  const title = pageTitle(document, route);
  const description = pageDescription(document, route);
  const path = project ? projectHref(project.slug) : '/';
  const image = document ? shareImage(document, project) : null;
  const imageUrl = image ? mediaUrl(config, image.path) : '';
  const data = noindex ? null : structuredData(input, project);
  return [
    `<title>${escapeHtml(title)}</title>`,
    meta('name', 'description', description),
    route.name === 'preview' ? '<meta name="referrer" content="no-referrer" />' : '',
    noindex
      ? '<meta name="robots" content="noindex, nofollow" />'
      : `<link rel="canonical" href="${escapeHtml(`${origin}${path}`)}" />`,
    meta('property', 'og:type', project ? 'article' : 'profile'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    noindex ? '' : meta('property', 'og:url', `${origin}${path}`),
    meta('property', 'og:site_name', document?.profile.name ?? ''),
    meta('property', 'og:image', imageUrl),
    image ? meta('property', 'og:image:width', String(image.width)) : '',
    image ? meta('property', 'og:image:height', String(image.height)) : '',
    image ? meta('property', 'og:image:alt', image.alt) : '',
    meta('name', 'twitter:card', imageUrl ? 'summary_large_image' : 'summary'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', imageUrl),
    data ? `<script type="application/ld+json">${jsonForScript(data)}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
}
