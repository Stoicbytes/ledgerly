import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { Link } from '../app/router';
import { Arrow } from '../components/Glyphs';
import { Reveal } from '../components/Motion';
import type { SiteConfig } from '../lib/config';
import { projectHref } from '../lib/routes';
import type { Project } from '../lib/types';
import { ProjectVisual } from './ProjectVisual';

type Filter = { key: string; label: string; test: (project: Project) => boolean };

function filtersFor(projects: Project[]): Filter[] {
  const categories = [...new Set(projects.map((p) => p.category).filter(Boolean))];
  const counts = new Map<string, number>();
  projects.forEach((p) => p.tech.forEach((tech) => counts.set(tech, (counts.get(tech) ?? 0) + 1)));
  const techs = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tech]) => tech);
  return [
    ...categories.map((category) => ({
      key: `c:${category}`,
      label: category,
      test: (p: Project) => p.category === category,
    })),
    ...techs
      .filter((tech) => !categories.includes(tech))
      .map((tech) => ({
        key: `t:${tech}`,
        label: tech,
        test: (p: Project) => p.tech.includes(tech),
      })),
  ];
}

/** Every project as a filterable index; on desktop a preview follows the pointer. */
export function ProjectIndex({
  projects,
  config,
}: {
  projects: Project[];
  config: SiteConfig | null;
}) {
  const filters = useMemo(() => filtersFor(projects), [projects]);
  const [active, setActive] = useState('all');
  const [hovered, setHovered] = useState<Project | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const filter = filters.find((item) => item.key === active);
  const shown = filter ? projects.filter(filter.test) : projects;

  const move = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || !previewRef.current) return;
    previewRef.current.style.transform = `translate3d(${event.clientX + 24}px, ${event.clientY - 90}px, 0)`;
  };

  return (
    <div className="project-index">
      <div className="project-index__head">
        <h3 className="project-index__title">All projects</h3>
        {filters.length ? (
          <div className="project-index__filters" role="group" aria-label="Filter projects">
            <button
              type="button"
              className="chip"
              aria-pressed={active === 'all'}
              onClick={() => setActive('all')}
            >
              All <span className="chip__count">{projects.length}</span>
            </button>
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                className="chip"
                aria-pressed={active === item.key}
                onClick={() => setActive(active === item.key ? 'all' : item.key)}
              >
                {item.label}{' '}
                <span className="chip__count">{projects.filter(item.test).length}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {shown.length} {shown.length === 1 ? 'project' : 'projects'} shown
      </p>
      <ol
        role="list"
        className="project-index__list"
        onPointerMove={move}
        onPointerLeave={() => setHovered(null)}
      >
        {shown.map((project, index) => (
          <Reveal as="li" key={project.id} index={index % 6} variant="fade">
            <Link
              className="index-row"
              href={projectHref(project.slug)}
              onPointerEnter={() => setHovered(project)}
              onFocus={() => setHovered(null)}
            >
              <span className="index-row__period mono">{project.period || '—'}</span>
              <span className="index-row__title">
                {project.title}
                {project.draft ? <span className="badge badge--draft">Draft</span> : null}
              </span>
              <span className="index-row__category">{project.category}</span>
              <span className="index-row__stack mono">{project.tech.slice(0, 3).join(' · ')}</span>
              <Arrow />
            </Link>
          </Reveal>
        ))}
      </ol>
      <div
        ref={previewRef}
        className={`index-preview${hovered ? ' is-visible' : ''}`}
        aria-hidden="true"
      >
        {hovered ? <ProjectVisual project={hovered} config={config} sizes="320px" /> : null}
      </div>
    </div>
  );
}
