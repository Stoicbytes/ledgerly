import type { PdfDocument } from './document';
import { binaryString, Dict, nameOf, numberOf, Stream, type PdfValue } from './syntax';

/** One character code shown: its text, its advance (1/1000 em) and whether it is a space. */
export type Glyph = { text: string; width: number; space: boolean };
export type Font = { decode: (bytes: Uint8Array) => Glyph[]; bold: boolean };

// Windows-1252 0x80–0x9F; the rest of WinAnsi is ASCII and Latin-1. (Kept here rather
// than shared with the PDF writer so this reader stays in its own download.)
const WIN_ANSI_HIGH = '€ ‚ƒ„…†‡ˆ‰Š‹Œ Ž  ‘’“”•–—˜™š›œ žŸ';
const winAnsi = (code: number) =>
  (code >= 32 && code < 127) || code >= 160
    ? String.fromCharCode(code)
    : code >= 0x80 && code <= 0x9f
      ? WIN_ANSI_HIGH[code - 0x80].trim()
      : '';

/** Rough Helvetica advances (1/1000 em) for a standard font that comes without widths. */
const standardWidth = (code: number, bold: boolean) => {
  if (code === 32 || code === 44 || code === 46 || code === 58) return 278;
  if (code >= 48 && code <= 57) return 556;
  if (code >= 65 && code <= 90) return bold ? 722 : 667;
  if (code >= 97 && code <= 122) return bold ? 556 : 500;
  return 333;
};

const GLYPH_NAMES: Record<string, string> = {
  space: ' ',
  comma: ',',
  period: '.',
  hyphen: '-',
  minus: '-',
  colon: ':',
  semicolon: ';',
  slash: '/',
  parenleft: '(',
  parenright: ')',
  ampersand: '&',
  at: '@',
  percent: '%',
  plus: '+',
  equal: '=',
  quotesingle: "'",
  quoteright: '’',
  quoteleft: '‘',
  quotedbl: '"',
  underscore: '_',
  numbersign: '#',
  asterisk: '*',
  bracketleft: '[',
  bracketright: ']',
  rupee: '₹',
  endash: '–',
  emdash: '—',
  bullet: '•',
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

function glyphText(name: string): string {
  const base = name.split('.')[0];
  if (/^[A-Za-z]$/.test(base)) return base;
  const code = /^(?:uni|u)([0-9A-F]{4,6})$/i.exec(base);
  if (code) return String.fromCodePoint(parseInt(code[1], 16));
  return GLYPH_NAMES[base] ?? '';
}

const utf16 = (hex: string) => {
  let out = '';
  for (let i = 0; i + 4 <= hex.length; i += 4)
    out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
};

/** A ToUnicode CMap: codes → text, and how many bytes a code takes. */
export function parseToUnicode(text: string) {
  const map = new Map<number, string>();
  let bytes = 0;
  for (const block of text.matchAll(/begincodespacerange([\s\S]*?)endcodespacerange/g)) {
    for (const hex of block[1].matchAll(/<([0-9a-f]+)>/gi))
      bytes = Math.max(bytes, hex[1].length / 2);
  }
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]*)>/gi)) {
      map.set(parseInt(pair[1], 16), utf16(pair[2]));
      bytes ||= pair[1].length / 2;
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const range = /<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(?:<([0-9a-f]*)>|\[([^\]]*)\])/gi;
    for (const item of block[1].matchAll(range)) {
      const low = parseInt(item[1], 16);
      const high = Math.min(parseInt(item[2], 16), low + 0xffff);
      bytes ||= item[1].length / 2;
      if (item[4] !== undefined) {
        [...item[4].matchAll(/<([0-9a-f]*)>/gi)].forEach((dst, i) =>
          map.set(low + i, utf16(dst[1])),
        );
        continue;
      }
      const start = utf16(item[3]);
      const head = start.slice(0, -1);
      const last = start.charCodeAt(start.length - 1);
      for (let code = low; code <= high; code += 1)
        map.set(code, head + String.fromCharCode(last + code - low));
    }
  }
  return { map, bytes: bytes || 1 };
}

/** Widths of a composite font: /W [first [w1 w2 …] first last w …]. */
function cidWidths(w: PdfValue | undefined, doc: PdfDocument) {
  const widths = new Map<number, number>();
  const list = doc.resolve(w);
  if (!Array.isArray(list)) return widths;
  for (let i = 0; i < list.length;) {
    const first = list[i];
    const next = doc.resolve(list[i + 1]);
    if (typeof first !== 'number') break;
    if (Array.isArray(next)) {
      next.forEach((value, k) => typeof value === 'number' && widths.set(first + k, value));
      i += 2;
    } else {
      const width = list[i + 2];
      if (typeof next === 'number' && typeof width === 'number') {
        for (let code = first; code <= Math.min(next, first + 0xffff); code += 1)
          widths.set(code, width);
      }
      i += 3;
    }
  }
  return widths;
}

const FALLBACK: Font = {
  bold: false,
  decode: (bytes) =>
    [...bytes].map((code) => ({ text: winAnsi(code), width: 500, space: code === 32 })),
};

/** A font resource ready to turn shown strings into text with advances. */
export async function loadFont(doc: PdfDocument, value: PdfValue | undefined): Promise<Font> {
  const dict = doc.dict(value);
  if (!dict) return FALLBACK;
  const composite = nameOf(dict.get('Subtype')) === 'Type0';
  const descendants = doc.resolve(dict.get('DescendantFonts'));
  const cid = composite && Array.isArray(descendants) ? doc.dict(descendants[0]) : null;
  const baseFont = nameOf(dict.get('BaseFont')) ?? '';
  const bold = /bold|black|heavy|semibold/i.test(baseFont);
  const toUnicodeStream = doc.resolve(dict.get('ToUnicode'));
  let unicode = { map: new Map<number, string>(), bytes: composite ? 2 : 1 };
  if (toUnicodeStream instanceof Stream) {
    const data = await doc.streamBytes(toUnicodeStream).catch(() => null);
    if (data) unicode = parseToUnicode(binaryString(data));
  }
  const codeBytes = composite ? Math.max(unicode.bytes, 2) : 1;
  const widths = cid ? cidWidths(cid.get('W'), doc) : new Map<number, number>();
  const defaultWidth = (cid && numberOf(cid.get('DW'))) ?? (composite ? 1000 : 0);
  const differences = new Map<number, string>();
  if (!composite) {
    const list = doc.resolve(dict.get('Widths'));
    const firstChar = numberOf(dict.get('FirstChar')) ?? 0;
    if (Array.isArray(list))
      list.forEach((w, i) => typeof w === 'number' && widths.set(firstChar + i, w));
    const encoding = doc.resolve(dict.get('Encoding'));
    const diffs = encoding instanceof Dict ? doc.resolve(encoding.get('Differences')) : null;
    let code = 0;
    for (const item of Array.isArray(diffs) ? diffs : []) {
      if (typeof item === 'number') code = item;
      else if (nameOf(item)) differences.set(code++, glyphText(nameOf(item)!));
    }
  }
  const width = (code: number) =>
    widths.get(code) ?? (composite ? defaultWidth : standardWidth(code, bold));
  return {
    bold,
    decode(bytes) {
      const glyphs: Glyph[] = [];
      for (let i = 0; i + codeBytes <= bytes.length; i += codeBytes) {
        let code = 0;
        for (let k = 0; k < codeBytes; k += 1) code = code * 256 + bytes[i + k];
        const text =
          unicode.map.get(code) ?? differences.get(code) ?? (composite ? '' : winAnsi(code));
        glyphs.push({ text, width: width(code), space: codeBytes === 1 && code === 32 });
      }
      return glyphs;
    },
  };
}
