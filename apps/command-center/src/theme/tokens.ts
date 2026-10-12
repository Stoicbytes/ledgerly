/**
 * Platform-neutral design tokens. Components read these through `useTheme()`;
 * nothing outside src/theme should contain raw sizes or hex colours.
 */

/** Compact spacing scale (owner preference: dense layouts). */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 6,
  3: 10,
  4: 12,
  5: 16,
  6: 20,
  8: 26,
  10: 32,
  14: 44,
  18: 56,
} as const;
export type SpaceToken = keyof typeof space;
export type SpaceScale = Record<SpaceToken, number>;

/** Phones: tighter padding and gaps (same tokens, smaller values). */
export const phoneSpace: SpaceScale = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 6,
  3: 8,
  4: 10,
  5: 12,
  6: 16,
  8: 20,
  10: 24,
  14: 32,
  18: 40,
};

export const radius = { xs: 5, sm: 8, md: 11, lg: 16, xl: 20, pill: 999 } as const;
export type RadiusToken = keyof typeof radius;

export const breakpoints = { sm: 0, md: 768, lg: 1024, xl: 1440 } as const;
export type Breakpoint = keyof typeof breakpoints;

/** Minimum touch target (WCAG 2.5.5 / platform guidance). */
export const minHitSize = 44;

export const layout = {
  /** Floating icon rail on tablet/desktop. */
  railWidth: 56,
  /** Floating pill tab bar on phones (excluding safe-area inset). */
  bottomBarHeight: 64,
  contentMaxWidth: 1480,
  headerHeight: 52,
  /** Outer canvas padding around the floating chrome on desktop. */
  canvasPadding: 12,
} as const;

export const duration = { instant: 0, fast: 120, base: 200, slow: 320 } as const;
export type DurationToken = keyof typeof duration;

export const spring = { damping: 20, stiffness: 220, mass: 1 } as const;
