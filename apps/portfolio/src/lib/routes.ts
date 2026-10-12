/** The site's pages. Project pages use the slug set in the dashboard. */
export type Route =
  { name: 'home' } | { name: 'project'; slug: string } | { name: 'preview' } | { name: 'notFound' };

export function parseRoute(pathname: string): Route {
  const path = `/${pathname.replace(/^\/+|\/+$/g, '')}`;
  if (path === '/') return { name: 'home' };
  if (path === '/preview') return { name: 'preview' };
  const project = /^\/projects\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path);
  if (project?.[1]) return { name: 'project', slug: project[1] };
  return { name: 'notFound' };
}

export const projectHref = (slug: string) => `/projects/${slug}`;

/** Section anchors on the home page, in page order. */
export const SECTION_IDS = {
  projects: 'work',
  skills: 'stack',
  experience: 'experience',
  about: 'about',
  education: 'credentials',
  beyond: 'beyond',
  contact: 'contact',
} as const;
