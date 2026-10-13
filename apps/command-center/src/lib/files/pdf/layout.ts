import { HELVETICA, HELVETICA_BOLD } from './fonts';

/**
 * A small A4 text layout for PDFs written directly: the standard Helvetica fonts
 * (nothing embedded), Windows-1252 text, lines wrapped with the fonts' own metrics, and
 * page breaks. Used by the CV and the reports.
 */
export const PAGE = { width: 595.28, height: 841.89, margin: 50 };
export const WIDTH = PAGE.width - PAGE.margin * 2;
export type Font = 'F1' | 'F2';

export const widthOf = (text: string, font: Font, size: number) => {
  const table = font === 'F2' ? HELVETICA_BOLD : HELVETICA;
  let total = 0;
  for (let i = 0; i < text.length; i += 1) total += table[text.charCodeAt(i) - 32] ?? 556;
  return (total * size) / 1000;
};

/** Words into lines no wider than `width` (the first line `firstWidth`). */
export function wrap(text: string, font: Font, size: number, width: number, firstWidth = width) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const limit = lines.length ? width : firstWidth;
    const next = line ? `${line} ${word}` : word;
    if (widthOf(next, font, size) <= limit || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export const escape = (text: string) => text.replace(/([\\()])/g, '\\$1');

export class Pages {
  pages: string[] = [];
  private ops: string[] = [];
  private y = PAGE.height - PAGE.margin;

  /** Room for `height` points, or a new page. */
  need(height: number) {
    if (this.y - height < PAGE.margin && this.ops.length) this.flush();
  }

  space(points: number) {
    this.y -= points;
  }

  text(x: number, runs: [Font, number, string][], leading: number) {
    this.need(leading);
    this.y -= leading;
    const body = runs.map(([font, size, text]) => `/${font} ${size} Tf (${escape(text)}) Tj`);
    this.ops.push(`BT ${x.toFixed(2)} ${this.y.toFixed(2)} Td ${body.join(' ')} ET`);
  }

  rule() {
    const y = (this.y - 3).toFixed(2);
    this.ops.push(`0.6 G 0.6 w ${PAGE.margin} ${y} m ${PAGE.width - PAGE.margin} ${y} l S 0 G`);
    this.y -= 6;
  }

  flush() {
    this.pages.push(this.ops.join('\n'));
    this.ops = [];
    this.y = PAGE.height - PAGE.margin;
  }

  done() {
    if (this.ops.length || !this.pages.length) this.flush();
    return this.pages;
  }
}
