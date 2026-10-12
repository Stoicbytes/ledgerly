import type { TextStyle } from 'react-native';

/** Font family names registered in src/app/_layout.tsx via expo-font. */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
export type FontWeightToken = keyof typeof fontFamily;

export type TypeStyle = Required<Pick<TextStyle, 'fontSize' | 'lineHeight'>> & {
  weight: FontWeightToken;
  letterSpacing?: number;
};

/**
 * Compact type scale (owner preference: dense, dashboard-like). The smallest
 * size is 11px, used only for captions and eyebrows; body text stays ≥ 13px.
 */
export const typeScale = {
  caption: { fontSize: 11, lineHeight: 15, weight: 'medium' },
  label: { fontSize: 12, lineHeight: 16, weight: 'medium' },
  body: { fontSize: 13, lineHeight: 19, weight: 'regular' },
  bodyStrong: { fontSize: 13, lineHeight: 19, weight: 'semibold' },
  bodyLg: { fontSize: 15, lineHeight: 21, weight: 'regular' },
  title: { fontSize: 16, lineHeight: 22, weight: 'semibold', letterSpacing: -0.2 },
  h2: { fontSize: 20, lineHeight: 26, weight: 'semibold', letterSpacing: -0.3 },
  h1: { fontSize: 24, lineHeight: 30, weight: 'semibold', letterSpacing: -0.6 },
  display: { fontSize: 30, lineHeight: 36, weight: 'semibold', letterSpacing: -0.9 },
  /** Large money figures in hero/KPI cards. */
  figure: { fontSize: 26, lineHeight: 32, weight: 'semibold', letterSpacing: -0.6 },
  figureSm: { fontSize: 19, lineHeight: 24, weight: 'semibold', letterSpacing: -0.4 },
  eyebrow: { fontSize: 11, lineHeight: 15, weight: 'semibold', letterSpacing: 0.7 },
} as const satisfies Record<string, TypeStyle>;
export type TypeVariant = keyof typeof typeScale;

/**
 * Phones (< 768 px wide): headings and figures step down again so cards stay
 * short; body text keeps its compact size.
 */
export type TypeScale = Record<TypeVariant, TypeStyle>;

export const phoneTypeScale: TypeScale = {
  ...typeScale,
  bodyLg: { fontSize: 14, lineHeight: 20, weight: 'regular' },
  title: { fontSize: 15, lineHeight: 20, weight: 'semibold', letterSpacing: -0.2 },
  h2: { fontSize: 17, lineHeight: 22, weight: 'semibold', letterSpacing: -0.3 },
  h1: { fontSize: 20, lineHeight: 26, weight: 'semibold', letterSpacing: -0.5 },
  display: { fontSize: 22, lineHeight: 28, weight: 'semibold', letterSpacing: -0.6 },
  figure: { fontSize: 22, lineHeight: 28, weight: 'semibold', letterSpacing: -0.5 },
  figureSm: { fontSize: 17, lineHeight: 22, weight: 'semibold', letterSpacing: -0.3 },
};
