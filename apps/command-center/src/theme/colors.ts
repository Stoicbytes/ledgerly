/**
 * Semantic colour roles for light and dark. Components use roles, never hex.
 *
 * Visual language (2026 redesign): soft grey canvas, white rounded cards,
 * a black "primary" for the main actions (white in dark mode), a graphite gradient for
 * hero cards,
 * near-black "ink" pills for the active navigation state, and a set of colourful
 * tints for categories. Contrast is enforced by src/theme/__tests__/contrast.test.ts.
 */
import { pieColors } from './pieColors';

export type Tint = { bg: string; fg: string };

export type ColorRoles = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  surfaceRaised: string;
  border: string;
  /** Boundaries of interactive controls (≥ 3:1 against surface). */
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Accent for text and icons on surfaces (links, active labels). */
  accent: string;
  accentPressed: string;
  accentSoft: string;
  onAccent: string;
  /** Black (light) / white (dark) fill for primary actions; always paired with `onPrimary` text. */
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  /** Near-black pill for the active navigation item and dark bars. */
  ink: string;
  inkPressed: string;
  onInk: string;
  onInkMuted: string;
  /** Hero gradient (top-left → bottom-right). Text on it uses `onBrand`. */
  brandFrom: string;
  brandTo: string;
  onBrand: string;
  onBrandMuted: string;
  focus: string;
  income: string;
  incomeSoft: string;
  expense: string;
  expenseSoft: string;
  transfer: string;
  transferSoft: string;
  investment: string;
  investmentSoft: string;
  profit: string;
  loss: string;
  neutral: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;
  info: string;
  infoSoft: string;
  scrim: string;
  /** Toasts and tooltips: high-emphasis surface opposite to the page. */
  inverseSurface: string;
  onInverseSurface: string;
  inverseAccent: string;
  /** Colourful category chips (icon `fg` on `bg`, ≥ 3:1). Fixed order. */
  tints: readonly Tint[];
  /** Categorical series, fixed order (never cycled), CVD-validated with the
   * dataviz palette checker (adjacent CVD ΔE ≥ 8, normal ΔE ≥ 15 in both modes).
   * Light slots 3–5 are < 3:1 on white, so charts ship labels or a table view. */
  chart: readonly string[];
  /** Two-series comparison bars (income vs expense) as in the reference design. */
  /** Stats pie (Money Manager style): bright slices coloured by rank, largest first.
   * Every slice is named in a callout and in the ranked list, so colour is never the only key. */
  pie: readonly string[];
  /** The folded "Other" slice. */
  pieOther: string;
  /** Text on a pie colour (the ranked list's percentage badges). */
  onPie: string;
  chartPositive: string;
  chartNegative: string;
  chartGrid: string;
  hatch: string;
};

export const lightColors: ColorRoles = {
  bg: '#EDEEF0',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F5F6',
  surfaceRaised: '#FFFFFF',
  border: '#E5E6E9',
  borderStrong: '#8B9099',
  textPrimary: '#111214',
  textSecondary: '#5B6068',
  textTertiary: '#6B7079',
  accent: '#111214',
  accentPressed: '#2A2C30',
  accentSoft: '#E9EAED',
  onAccent: '#FFFFFF',
  primary: '#111214',
  primaryPressed: '#2A2C30',
  primarySoft: '#E9EAED',
  onPrimary: '#FFFFFF',
  ink: '#121315',
  inkPressed: '#2A2C30',
  onInk: '#FFFFFF',
  onInkMuted: '#B4B8BE',
  brandFrom: '#3A3D42',
  brandTo: '#0B0C0E',
  onBrand: '#FFFFFF',
  onBrandMuted: '#D9DBDF',
  focus: '#111214',
  income: '#286F2E',
  incomeSoft: '#EAF6E3',
  expense: '#C62828',
  expenseSoft: '#FDECEC',
  transfer: '#3D5A80',
  transferSoft: '#E9EEF5',
  investment: '#6D28D9',
  investmentSoft: '#F1EAFD',
  profit: '#286F2E',
  loss: '#C62828',
  neutral: '#5B6068',
  success: '#286F2E',
  successSoft: '#EAF6E3',
  warning: '#9A5B00',
  warningSoft: '#FFF4DB',
  danger: '#C62828',
  dangerSoft: '#FDECEC',
  onDanger: '#FFFFFF',
  info: '#1D5BD8',
  infoSoft: '#E8EFFD',
  scrim: 'rgba(17, 18, 20, 0.45)',
  inverseSurface: '#121315',
  onInverseSurface: '#F3F4F6',
  inverseAccent: '#FFFFFF',
  tints: [
    { bg: '#EAF8D2', fg: '#3E7A12' },
    { bg: '#EFE8FE', fg: '#6D28D9' },
    { bg: '#E3F1FD', fg: '#1D64C4' },
    { bg: '#FFE9E1', fg: '#C2410C' },
    { bg: '#FFF3D1', fg: '#946200' },
    { bg: '#FDE6F1', fg: '#BE185D' },
    { bg: '#DDF5F0', fg: '#0F766E' },
    { bg: '#E7E9FD', fg: '#4338CA' },
  ],
  chart: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#4A3AA7', '#E34948'],
  ...pieColors,
  chartPositive: '#121315',
  chartNegative: '#B4B8BE',
  chartGrid: '#ECEDEF',
  hatch: '#D9DCE0',
};

// Dark mode: pure black cards and tiles on a dark grey page; inner rows sit a step lighter.
export const darkColors: ColorRoles = {
  bg: '#1A1B1E',
  surface: '#000000',
  surfaceMuted: '#141518',
  surfaceRaised: '#0B0C0D',
  border: '#2A2D31',
  borderStrong: '#6A6F78',
  textPrimary: '#F3F4F6',
  textSecondary: '#A9AEB6',
  textTertiary: '#8E939B',
  accent: '#F3F4F6',
  accentPressed: '#D9DBDF',
  accentSoft: '#2A2D31',
  onAccent: '#111214',
  primary: '#F3F4F6',
  primaryPressed: '#D9DBDF',
  primarySoft: '#2A2D31',
  onPrimary: '#111214',
  ink: '#F3F4F6',
  inkPressed: '#D9DBDF',
  onInk: '#111214',
  onInkMuted: '#4B5058',
  brandFrom: '#3A3D42',
  brandTo: '#1C1E21',
  onBrand: '#FFFFFF',
  onBrandMuted: '#D9DBDF',
  focus: '#F3F4F6',
  income: '#8BD86A',
  incomeSoft: '#1E2D18',
  expense: '#FF7A7A',
  expenseSoft: '#3A1A1A',
  transfer: '#9DB4D6',
  transferSoft: '#1B2433',
  investment: '#C4B5FD',
  investmentSoft: '#251E3D',
  profit: '#8BD86A',
  loss: '#FF7A7A',
  neutral: '#A9AEB6',
  success: '#8BD86A',
  successSoft: '#1E2D18',
  warning: '#F5C04E',
  warningSoft: '#2E2510',
  danger: '#FF7A7A',
  dangerSoft: '#3A1A1A',
  onDanger: '#111214',
  info: '#7FB0FF',
  infoSoft: '#16243A',
  scrim: 'rgba(0, 0, 0, 0.6)',
  inverseSurface: '#F3F4F6',
  onInverseSurface: '#111214',
  inverseAccent: '#111214',
  tints: [
    { bg: '#26331A', fg: '#B6F03C' },
    { bg: '#2A2140', fg: '#C4B5FD' },
    { bg: '#16283A', fg: '#7FB6FF' },
    { bg: '#3A2219', fg: '#FF9F7A' },
    { bg: '#332A12', fg: '#F5C04E' },
    { bg: '#3A1A2B', fg: '#F48FC0' },
    { bg: '#123029', fg: '#5EDBC4' },
    { bg: '#1E2142', fg: '#A5B0FF' },
  ],
  chart: ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181', '#008300', '#9085E9', '#E66767'],
  ...pieColors,
  chartPositive: '#F3F4F6',
  chartNegative: '#6A6F78',
  chartGrid: '#25272B',
  hatch: '#3A3D42',
};
