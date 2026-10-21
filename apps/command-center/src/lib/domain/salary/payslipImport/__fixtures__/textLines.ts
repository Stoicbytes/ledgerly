import type { TextLine } from '../types';

/** A test line from [x, text] cells; the words of a cell sit close together. */
export const line = (cells: [number, string][], y = 0, size = 10): TextLine => ({
  page: 0,
  y,
  words: cells.flatMap(([x, text]) =>
    text.split(' ').map((word, k) => ({
      text: word,
      x: x + k * 30,
      end: x + k * 30 + 26,
      size,
      bold: false,
    })),
  ),
});
