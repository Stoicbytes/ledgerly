import { darkColors, lightColors, type ColorRoles } from '../colors';
import { noteColors } from '../noteColors';

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

type Pair = [keyof ColorRoles, keyof ColorRoles, number];

// WCAG 2.2: 4.5:1 for text, 3:1 for UI component boundaries and large text.
const pairs: Pair[] = [
  ['textPrimary', 'bg', 4.5],
  ['textPrimary', 'surface', 4.5],
  ['textSecondary', 'surface', 4.5],
  ['textSecondary', 'bg', 4.5],
  ['textSecondary', 'surfaceMuted', 4.5],
  ['textTertiary', 'surface', 4.5],
  ['textTertiary', 'surfaceMuted', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'accentSoft', 4.5],
  ['onPrimary', 'primary', 4.5],
  ['onPrimary', 'primaryPressed', 4.5],
  ['onInk', 'ink', 4.5],
  ['onInkMuted', 'ink', 4.5],
  ['onBrand', 'brandFrom', 4.5],
  ['onBrand', 'brandTo', 4.5],
  ['onBrandMuted', 'brandFrom', 4.5],
  ['onBrandMuted', 'brandTo', 4.5],
  ['onDanger', 'danger', 4.5],
  ['income', 'surface', 4.5],
  ['expense', 'surface', 4.5],
  ['transfer', 'surface', 4.5],
  ['investment', 'surface', 4.5],
  ['success', 'successSoft', 4.5],
  ['warning', 'warningSoft', 4.5],
  ['danger', 'dangerSoft', 4.5],
  ['info', 'infoSoft', 4.5],
  ['investment', 'investmentSoft', 4.5],
  ['onInverseSurface', 'inverseSurface', 4.5],
  ['inverseAccent', 'inverseSurface', 4.5],
  ['borderStrong', 'surface', 3],
  ['focus', 'surface', 3],
  ['focus', 'bg', 3],
];

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('%s theme contrast', (_name, colors) => {
  it.each(pairs)('%s on %s ≥ %d:1', (foreground, background, minimum) => {
    expect(
      contrast(colors[foreground] as string, colors[background] as string),
    ).toBeGreaterThanOrEqual(minimum);
  });

  it.each(colors.tints.map((tint, index) => [index, tint] as const))(
    'category tint %i icon ≥ 3:1 on its background',
    (_index, tint) => {
      expect(contrast(tint.fg, tint.bg)).toBeGreaterThanOrEqual(3);
    },
  );

  it('keeps the categorical chart palette at 8 fixed slots', () => {
    expect(colors.chart).toHaveLength(8);
    expect(new Set(colors.chart).size).toBe(8);
  });
});

describe('note colours', () => {
  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)('keep body and secondary text readable in %s mode', (scheme, colors) => {
    for (const background of Object.values(noteColors[scheme])) {
      expect(contrast(colors.textPrimary, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.textSecondary, background)).toBeGreaterThanOrEqual(3);
    }
  });
});
