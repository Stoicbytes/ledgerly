/**
 * Note card colours (Google Keep style), per theme. `default` uses the normal card
 * surface. Text on every colour meets WCAG AA (tested in theme/__tests__).
 */
export const NOTE_COLORS = [
  'default',
  'coral',
  'peach',
  'sand',
  'mint',
  'sage',
  'fog',
  'storm',
  'dusk',
  'blossom',
  'clay',
  'chalk',
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export const noteColors: Record<'light' | 'dark', Record<Exclude<NoteColor, 'default'>, string>> = {
  light: {
    coral: '#FAAFA8',
    peach: '#F39F76',
    sand: '#FFF8B8',
    mint: '#E2F6D3',
    sage: '#B4DDD3',
    fog: '#D4E4ED',
    storm: '#AECCDC',
    dusk: '#D3BFDB',
    blossom: '#F6E2DD',
    clay: '#E9E3D4',
    chalk: '#EFEFF1',
  },
  dark: {
    coral: '#77172E',
    peach: '#692B17',
    sand: '#7C4A03',
    mint: '#264D3B',
    sage: '#0C625D',
    fog: '#256377',
    storm: '#284255',
    dusk: '#472E5B',
    blossom: '#6C394F',
    clay: '#4B443A',
    chalk: '#232427',
  },
};
