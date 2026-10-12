import { useWindowDimensions } from 'react-native';
import { breakpoints, type Breakpoint } from '@/theme/tokens';

export function breakpointForWidth(width: number): Breakpoint {
  if (width >= breakpoints.xl) return 'xl';
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  return 'sm';
}

export type LayoutMode = 'mobile' | 'tablet' | 'desktop';

export function layoutModeForWidth(width: number): LayoutMode {
  const breakpoint = breakpointForWidth(width);
  if (breakpoint === 'sm') return 'mobile';
  if (breakpoint === 'md') return 'tablet';
  return 'desktop';
}

export type Density = 'roomy' | 'dense' | 'short';

/**
 * Vertical density for single-screen (fit) pages. Laptop browsers often leave
 * only ~650–750 px for the page, so layouts tighten below 820 px and fall back
 * to normal scrolling below 700 px rather than clipping content.
 */
export function densityForHeight(height: number): Density {
  if (height >= 820) return 'roomy';
  if (height >= 700) return 'dense';
  return 'short';
}

/** Responsive state derived from the window (not the device type). */
export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const breakpoint = breakpointForWidth(width);
  const mode = layoutModeForWidth(width);
  const density = densityForHeight(height);
  return {
    width,
    height,
    breakpoint,
    mode,
    density,
    isMobile: mode === 'mobile',
    isDesktop: mode === 'desktop',
    /** Desktop with limited height: use compact cards on fit pages. */
    isDense: mode === 'desktop' && density === 'dense',
  };
}
