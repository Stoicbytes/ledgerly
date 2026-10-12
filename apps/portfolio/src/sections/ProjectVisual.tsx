import type { CSSProperties } from 'react';
import { GenerativeCover } from '../components/GenerativeCover';
import { Img } from '../components/Img';
import type { SiteConfig } from '../lib/config';
import type { Project } from '../lib/types';

/** A project's cover (or its generated blueprint), shared by cards and the project page. */
export function ProjectVisual({
  project,
  config,
  sizes,
  priority,
  className = '',
}: {
  project: Project;
  config: SiteConfig | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const transition = { viewTransitionName: `cover-${project.slug}` } as CSSProperties;
  return (
    <div className={`project-visual ${className}`} data-accent={project.accent} style={transition}>
      {project.cover ? (
        <Img
          media={project.cover}
          config={config}
          sizes={sizes}
          priority={priority}
          className="project-visual__img"
        />
      ) : (
        <GenerativeCover project={project} className="project-visual__img" />
      )}
    </div>
  );
}
