import type { Project } from '../lib/types';

/**
 * A cover drawn from the project itself when no image was uploaded: a blueprint of
 * modules labelled with the project's technologies, laid out from its slug, so every
 * project looks distinct and a missing image never leaves a hole.
 */
function random(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

type Module = { x: number; y: number; w: number; h: number; filled: boolean; label: string };

function layout(project: Pick<Project, 'slug' | 'tech'>): Module[] {
  const rand = random(project.slug);
  const labels = project.tech.slice(0, 6);
  const modules: Module[] = [];
  const rows = 4;
  let labelIndex = 0;
  for (let row = 0; row < rows; row += 1) {
    let x = 120 + rand() * 80;
    const y = 170 + row * 180;
    while (x < 1380) {
      const w = 160 + Math.floor(rand() * 4) * 90;
      if (x + w > 1480) break;
      const labelled = rand() > 0.45 && labelIndex < labels.length;
      modules.push({
        x,
        y,
        w,
        h: 96,
        filled: rand() > 0.72,
        label: labelled ? (labels[labelIndex++] ?? '') : '',
      });
      x += w + 40 + rand() * 60;
    }
  }
  return modules;
}

export function GenerativeCover({
  project,
  className,
}: {
  project: Pick<Project, 'slug' | 'tech' | 'title'>;
  className?: string;
}) {
  const modules = layout(project);
  const rand = random(`${project.slug}:glow`);
  const glowX = 300 + rand() * 1000;
  const glowY = 200 + rand() * 500;
  const links = modules.slice(0, -1).filter((_, index) => index % 3 === 0);
  return (
    <svg
      className={`generative-cover ${className ?? ''}`}
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient
          id={`glow-${project.slug}`}
          cx={glowX}
          cy={glowY}
          r="760"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        </radialGradient>
        <pattern id={`grid-${project.slug}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="rgb(236 240 247 / 5%)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1600" height="1000" style={{ fill: 'var(--ink-2)' }} />
      <rect width="1600" height="1000" fill={`url(#grid-${project.slug})`} />
      <rect width="1600" height="1000" fill={`url(#glow-${project.slug})`} />
      {links.map((module, index) => {
        const next = modules[modules.indexOf(module) + 1];
        if (!next) return null;
        return (
          <path
            key={`l${index}`}
            d={`M${module.x + module.w / 2} ${module.y + module.h} V${module.y + module.h + 42} H${next.x + next.w / 2} V${next.y}`}
            fill="none"
            style={{ stroke: 'var(--accent)', strokeOpacity: 0.35 }}
            strokeDasharray="4 6"
          />
        );
      })}
      {modules.map((module, index) => (
        <g key={index}>
          <rect
            x={module.x}
            y={module.y}
            width={module.w}
            height={module.h}
            rx="14"
            style={
              module.filled
                ? {
                    fill: 'var(--accent)',
                    fillOpacity: 0.14,
                    stroke: 'var(--accent)',
                    strokeOpacity: 0.6,
                  }
                : { fill: 'rgb(236 240 247 / 2%)', stroke: 'rgb(236 240 247 / 14%)' }
            }
          />
          {module.label ? (
            <text
              x={module.x + 22}
              y={module.y + 56}
              style={{
                fill: module.filled ? 'var(--accent)' : 'rgb(236 240 247 / 60%)',
                fontFamily: 'var(--font-mono)',
              }}
              fontSize="26"
              letterSpacing="1"
            >
              {module.label.length > Math.floor(module.w / 17)
                ? `${module.label.slice(0, Math.floor(module.w / 17) - 1)}…`
                : module.label}
            </text>
          ) : (
            <circle
              cx={module.x + 26}
              cy={module.y + 48}
              r="5"
              style={{ fill: 'var(--accent)', fillOpacity: 0.55 }}
            />
          )}
        </g>
      ))}
    </svg>
  );
}
