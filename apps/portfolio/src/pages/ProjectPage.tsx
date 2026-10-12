import { Link } from '../app/router';
import { Arrow } from '../components/Glyphs';
import { Img } from '../components/Img';
import { Markdown } from '../components/Markdown';
import { Reveal, SplitWords } from '../components/Motion';
import type { SiteConfig } from '../lib/config';
import { STATUS_LABEL } from '../lib/format';
import { projectHref } from '../lib/routes';
import type { PortfolioDocument, Project } from '../lib/types';
import { ProjectVisual } from '../sections/ProjectVisual';

function Meta({ project }: { project: Project }) {
  const items = [
    ['Role', project.role],
    ['Period', project.period],
    ['Status', STATUS_LABEL[project.status] ?? ''],
    ['Category', project.category],
  ].filter(([, value]) => value);
  return (
    <dl className="project-meta">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="mono faint">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Links({ project }: { project: Project }) {
  const links = [
    [project.liveUrl, 'Visit live site', 'btn btn--primary'],
    [project.repoUrl, 'Source code', 'btn btn--ghost'],
    [project.docsUrl, 'Documentation', 'btn btn--ghost'],
  ].filter((item): item is [string, string, string] => Boolean(item[0]));
  if (!links.length) return null;
  return (
    <div className="project-links">
      {links.map(([href, label, className]) => (
        <a key={label} className={className} href={href} target="_blank" rel="noopener noreferrer">
          {label} <Arrow direction="out" />
        </a>
      ))}
    </div>
  );
}

export function ProjectPage({
  document: doc,
  project,
  config,
}: {
  document: PortfolioDocument;
  project: Project;
  config: SiteConfig | null;
}) {
  const index = doc.projects.findIndex((item) => item.id === project.id);
  const next = doc.projects.length > 1 ? doc.projects[(index + 1) % doc.projects.length] : null;
  const diagrams = project.gallery.filter((item) => item.kind === 'diagram');
  const screenshots = project.gallery.filter((item) => item.kind === 'screenshot');
  return (
    <article className="project-page" data-accent={project.accent}>
      <header className="container project-hero">
        <Link className="link link--muted project-hero__back" href="/#work">
          <Arrow direction="left" size={14} /> All work
        </Link>
        <p className="project-hero__kicker mono">
          {[project.category, STATUS_LABEL[project.status]].filter(Boolean).join(' · ')}
          {project.draft ? <span className="badge badge--draft">Draft</span> : null}
        </p>
        <h1 className="project-hero__title">
          <SplitWords text={project.title} />
        </h1>
        {project.tagline ? (
          <Reveal as="p" className="project-hero__tagline" index={2}>
            {project.tagline}
          </Reveal>
        ) : null}
        <Reveal index={3} className="project-hero__meta">
          <Meta project={project} />
          <Links project={project} />
        </Reveal>
      </header>
      <div className="container">
        <ProjectVisual
          project={project}
          config={config}
          sizes="(min-width: 1400px) 1360px, 100vw"
          priority
          className="project-cover"
        />
      </div>
      <div className="container project-body">
        <div className="project-body__main">
          {project.summary ? <p className="project-body__lead">{project.summary}</p> : null}
          {project.body ? (
            <section aria-labelledby="overview-title">
              <h2 id="overview-title" className="project-body__label mono">
                Overview
              </h2>
              <Markdown source={project.body} />
            </section>
          ) : null}
          {project.challenges ? (
            <section aria-labelledby="challenges-title">
              <h2 id="challenges-title" className="project-body__label mono">
                Challenges &amp; solutions
              </h2>
              <Markdown source={project.challenges} />
            </section>
          ) : null}
          {project.architecture || diagrams.length ? (
            <section aria-labelledby="architecture-title">
              <h2 id="architecture-title" className="project-body__label mono">
                Architecture
              </h2>
              <Markdown source={project.architecture} />
              {diagrams.map((item) => (
                <figure key={item.path} className="project-figure">
                  <Img media={item} config={config} sizes="(min-width: 1100px) 760px, 100vw" />
                  {item.caption ? <figcaption>{item.caption}</figcaption> : null}
                </figure>
              ))}
            </section>
          ) : null}
        </div>
        <aside className="project-body__aside">
          {project.features.length ? (
            <div className="aside-block">
              <h2 className="project-body__label mono">Key features</h2>
              <ul role="list" className="feature-list">
                {project.features.map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {project.tech.length ? (
            <div className="aside-block">
              <h2 className="project-body__label mono">Stack</h2>
              <ul role="list" className="tags">
                {project.tech.map((tech) => (
                  <li key={tech} className="tag">
                    {tech}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
      {screenshots.length ? (
        <div className="container gallery">
          {screenshots.map((item, i) => (
            <Reveal as="figure" key={item.path} index={i % 4} className="gallery__item">
              <Img media={item} config={config} sizes="(min-width: 900px) 50vw, 100vw" />
              {item.caption ? <figcaption>{item.caption}</figcaption> : null}
            </Reveal>
          ))}
        </div>
      ) : null}
      {next && next.id !== project.id ? (
        <div className="container">
          <Link className="next-project" href={projectHref(next.slug)} data-accent={next.accent}>
            <span className="mono faint">Next project</span>
            <span className="next-project__title">{next.title}</span>
            <Arrow size={28} />
          </Link>
        </div>
      ) : null}
    </article>
  );
}
