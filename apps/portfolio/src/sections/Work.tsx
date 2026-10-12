import { Link } from '../app/router';
import { Arrow } from '../components/Glyphs';
import { Reveal, SectionHead } from '../components/Motion';
import { usePointerGlow } from '../hooks/motion';
import type { SiteConfig } from '../lib/config';
import { STATUS_LABEL } from '../lib/format';
import { projectHref } from '../lib/routes';
import type { Project } from '../lib/types';
import { ProjectIndex } from './ProjectIndex';
import { ProjectVisual } from './ProjectVisual';

function ProjectCase({
  project,
  index,
  config,
}: {
  project: Project;
  index: number;
  config: SiteConfig | null;
}) {
  const glow = usePointerGlow<HTMLDivElement>();
  const meta = [project.period, project.category, STATUS_LABEL[project.status]].filter(Boolean);
  return (
    <Reveal
      as="article"
      className={`case${index % 2 ? ' case--flip' : ''}${project.draft ? ' draft-outline' : ''}`}
      data-accent={project.accent}
    >
      <div ref={glow} className="case__media spotlight">
        <ProjectVisual
          project={project}
          config={config}
          sizes="(min-width: 1100px) 760px, 100vw"
          priority={index === 0}
        />
      </div>
      <div className="case__body">
        <p className="case__index mono">
          <span>{String(index + 1).padStart(2, '0')}</span>
          {meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
          {project.draft ? <span className="badge badge--draft">Draft</span> : null}
        </p>
        <h3 className="case__title">
          <Link className="case__link" href={projectHref(project.slug)}>
            {project.title}
          </Link>
        </h3>
        {project.tagline ? <p className="case__tagline">{project.tagline}</p> : null}
        {project.summary ? <p className="case__summary">{project.summary}</p> : null}
        {project.tech.length ? (
          <ul className="tags" role="list" aria-label="Technologies">
            {project.tech.slice(0, 6).map((tech) => (
              <li key={tech} className="tag">
                {tech}
              </li>
            ))}
          </ul>
        ) : null}
        <span className="case__cta" aria-hidden="true">
          View case study <Arrow />
        </span>
      </div>
    </Reveal>
  );
}

export function Work({
  projects,
  config,
  index,
}: {
  projects: Project[];
  config: SiteConfig | null;
  index: number;
}) {
  const featured = projects.filter((project) => project.featured);
  const lead = featured.length ? featured : projects.slice(0, 3);
  const showIndex = projects.length > lead.length;
  return (
    <section className="page-section work" id="work" aria-labelledby="work-title">
      <div className="container">
        <SectionHead
          index={index}
          label="Selected work"
          id="work-title"
          title={
            <>
              Things I&apos;ve <em>built</em>
            </>
          }
          lead={
            showIndex
              ? 'Selected case studies first; every project is in the index below.'
              : undefined
          }
        />
        <div className="cases">
          {lead.map((project, i) => (
            <ProjectCase key={project.id} project={project} index={i} config={config} />
          ))}
        </div>
        {showIndex ? <ProjectIndex projects={projects} config={config} /> : null}
      </div>
    </section>
  );
}
