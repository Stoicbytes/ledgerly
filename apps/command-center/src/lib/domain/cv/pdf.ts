import { assemblePdf } from '@/lib/files/pdf/assemble';
import { Pages, PAGE, WIDTH, widthOf, wrap } from '@/lib/files/pdf/layout';
import { toWinAnsi } from '@/lib/files/pdf/winAnsi';
import { cvLines, type CvLine } from './layout';
import type { Cv } from './types';

/**
 * The CV as an A4 PDF: the standard Helvetica fonts, real text in reading order, one
 * column, no images or tables. That is the format ATS parsers extract most reliably.
 */
function draw(out: Pages, line: CvLine) {
  const left = PAGE.margin;
  switch (line.kind) {
    case 'name':
      return out.text(left, [['F2', 20, toWinAnsi(line.text)]], 24);
    case 'title':
      return out.text(left, [['F1', 11.5, toWinAnsi(line.text)]], 16);
    case 'contact':
      for (const part of wrap(toWinAnsi(line.text), 'F1', 9.5, WIDTH)) {
        out.text(left, [['F1', 9.5, part]], 13);
      }
      return;
    case 'heading':
      out.need(15 + 6 + 28);
      out.space(10);
      out.text(left, [['F2', 11, toWinAnsi(line.text.toUpperCase())]], 15);
      return out.rule();
    case 'entry': {
      // Dates follow the title on the same line (right-aligned dates are read out of order).
      const dates = line.dates ? ` | ${toWinAnsi(line.dates)}` : '';
      const parts = wrap(toWinAnsi(line.text), 'F2', 10.5, WIDTH);
      const last = parts[parts.length - 1];
      const fits = widthOf(last, 'F2', 10.5) + widthOf(dates, 'F1', 10) <= WIDTH;
      out.need(14 * (parts.length + 1) + 26);
      out.space(5);
      parts.forEach((part, index) => {
        const tail = index === parts.length - 1 && fits && dates;
        out.text(
          left,
          tail
            ? [
                ['F2', 10.5, part],
                ['F1', 10, dates],
              ]
            : [['F2', 10.5, part]],
          14,
        );
      });
      if (dates && !fits) out.text(left, [['F1', 10, dates.slice(3)]], 13.5);
      return;
    }
    case 'bullet': {
      const parts = wrap(toWinAnsi(line.text), 'F1', 10, WIDTH - 12);
      parts.forEach((part, index) => {
        if (index === 0) out.text(left + 2, [['F1', 10, `\x95`]], 13.5);
        if (index === 0) out.space(-13.5);
        out.text(left + 12, [['F1', 10, part]], 13.5);
      });
      return;
    }
    case 'label': {
      const label = `${toWinAnsi(line.label)}: `;
      const first = WIDTH - widthOf(label, 'F2', 10);
      wrap(toWinAnsi(line.text), 'F1', 10, WIDTH, first).forEach((part, index) => {
        out.text(
          left,
          index
            ? [['F1', 10, part]]
            : [
                ['F2', 10, label],
                ['F1', 10, part],
              ],
          13.5,
        );
      });
      return;
    }
    default:
      for (const part of wrap(toWinAnsi(line.text), 'F1', 10, WIDTH)) {
        out.text(left, [['F1', 10, part]], 13.5);
      }
  }
}

/** PDF bytes for the CV. */
export function cvPdf(cv: Cv): Uint8Array {
  const out = new Pages();
  for (const line of cvLines(cv)) draw(out, line);
  return assemblePdf(out.done(), cv.name ? `${cv.name} - CV` : 'CV', cv.name);
}
