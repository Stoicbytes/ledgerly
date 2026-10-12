import type { ViewStyle } from 'react-native';

export type ElevationLevel = 0 | 1 | 2 | 3;

/** Cross-platform `boxShadow` (RN New Architecture + RN Web). Dark mode relies on
 * surface tints instead of shadows, so dark elevations are hairline-only. */
export function elevation(level: ElevationLevel, scheme: 'light' | 'dark'): ViewStyle {
  if (level === 0 || scheme === 'dark') return {};
  const shadows: Record<Exclude<ElevationLevel, 0>, string> = {
    1: '0px 1px 2px rgba(17, 18, 20, 0.04)',
    2: '0px 10px 30px rgba(17, 18, 20, 0.08), 0px 2px 6px rgba(17, 18, 20, 0.04)',
    3: '0px 28px 60px rgba(17, 18, 20, 0.18), 0px 6px 16px rgba(17, 18, 20, 0.08)',
  };
  return { boxShadow: shadows[level] };
}
