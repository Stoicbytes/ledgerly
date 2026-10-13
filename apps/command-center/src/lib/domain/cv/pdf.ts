import { cvLines, type CvLine } from './layout';
import { HELVETICA, HELVETICA_BOLD } from './pdfFonts';
import type { Cv } from './types';
import { toWinAnsi } from './winAnsi';

/**
 * The CV as an A4 PDF, written directly: the standard Helvetica fonts (nothing embedded),
 * real text in reading order, one column, no images or tables. That is the format ATS
 * parsers extract most reliably. Lines wrap with the fonts' own metrics.
 */
const PAGE = { width: 595.28, height: 841.89, margin: 50 };
const WIDTH = PAGE.width - PAGE.margin * 2;
type Font = 'F1' | 'F2';

const widthOf = (text: string, font: Font, size: number) => {
  const table = font === 'F2' ? HELVETICA_BOLD : HELVETICA;
  let total = 0;
  for (let i = 0; i < text.length; i += 1) total += table[text.charCodeAt(i) - 32] ?? 556;
  return (total * size) / 1000;
};

/** Words into lines no wider than `width` (the first line `firstWidth`). */
function wrap(text: string, font: Font, size: number, width: number, firstWidth = width) {
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

const escape = (text: string) => text.replace(/([\\()])/g, '\\$1');

class Pages {
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
  const pages = out.done();
  const objects: string[] = [];
  const font = (name: string) =>
    `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  const firstPage = 6;
  const kids = pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(' ');
  const title = escape(toWinAnsi(cv.name ? `${cv.name} - CV` : 'CV'));
  objects.push(
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    font('Helvetica'),
    font('Helvetica-Bold'),
    `<< /Title (${title}) /Author (${escape(toWinAnsi(cv.name))}) /Creator (Ledgerly) >>`,
  );
  pages.forEach((content, i) => {
    const contentRef = firstPage + i * 2 + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentRef} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });
  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = objects.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}
