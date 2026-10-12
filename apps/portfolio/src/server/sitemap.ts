import { escapeHtml } from '../lib/escape';
import { projectHref } from '../lib/routes';
import type { PortfolioDocument } from '../lib/types';

/** The home page and every published project, dated by the last publish. */
export function sitemapXml(origin: string, document: PortfolioDocument | null): string {
  const lastmod = document?.publishedAt ? document.publishedAt.slice(0, 10) : '';
  const entry = (path: string) =>
    `  <url><loc>${escapeHtml(`${origin}${path}`)}</loc>${
      lastmod ? `<lastmod>${lastmod}</lastmod>` : ''
    }</url>`;
  const paths = document
    ? ['/', ...document.projects.map((project) => projectHref(project.slug))]
    : [];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map(entry),
    '</urlset>',
    '',
  ].join('\n');
}

/** Everything public may be indexed except preview links. */
export function robotsTxt(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /preview',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}
