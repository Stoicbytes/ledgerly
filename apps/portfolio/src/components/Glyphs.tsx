import { createElement } from 'react';
import { ICONS } from '../lib/icons';

type ArrowDirection = 'right' | 'left' | 'down' | 'out';

const ARROWS: Record<ArrowDirection, string> = {
  right: 'M5 12h14M13 6l6 6-6 6',
  left: 'M19 12H5M11 6l-6 6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  out: 'M7 17 17 7M8 7h9v9',
};

/** Arrows for links and buttons (decorative: the link text says where it goes). */
export function Arrow({
  direction = 'right',
  size = 16,
}: {
  direction?: ArrowDirection;
  size?: number;
}) {
  return (
    <svg
      className={`arrow arrow--${direction}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ARROWS[direction]} />
    </svg>
  );
}

/** A padlock (Lucide "lock" outline) for the way into the private dashboard. */
export function LockGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg
      className="lock"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

const initials = (name: string) =>
  name
    .replace(/[^A-Za-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || name.slice(0, 2).toUpperCase();

/** A skill's icon from the built-in set, or its initials. */
export function SkillIcon({
  icon,
  name,
  size = 20,
}: {
  icon: string;
  name: string;
  size?: number;
}) {
  const nodes = ICONS[icon];
  if (!nodes) {
    return (
      <span className="skill-icon skill-icon--initials" aria-hidden="true">
        {initials(name)}
      </span>
    );
  }
  return (
    <span className="skill-icon" aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        {nodes.map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs }))}
      </svg>
    </span>
  );
}
