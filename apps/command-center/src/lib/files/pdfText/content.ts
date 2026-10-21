import type { PdfDocument } from './document';
import { loadFont, type Font } from './fonts';
import { Dict, Lexer, nameOf, Op, Stream, type PdfValue } from './syntax';

/** A run of text as placed on the page (points from the bottom-left corner). */
export type TextRun = {
  x: number;
  y: number;
  width: number;
  size: number;
  bold: boolean;
  text: string;
};

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];
const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
const asMatrix = (value: PdfValue[]) =>
  value.length === 6 && value.every((v) => typeof v === 'number') ? (value as Matrix) : null;

/** Stops a crafted file from looping through forms or showing millions of strings. */
const MAX_DEPTH = 6;
const MAX_RUNS = 20_000;

export type ContentResult = { runs: TextRun[]; images: number };

/**
 * Runs a page's content streams far enough to know where each string of text lands:
 * graphics state, text state and form XObjects. Paths, colours and images are skipped
 * (images are only counted, to tell a scanned page apart).
 */
export async function readContent(
  doc: PdfDocument,
  data: Uint8Array,
  resources: Dict | null,
  result: ContentResult = { runs: [], images: 0 },
  base: Matrix = IDENTITY,
  depth = 0,
): Promise<ContentResult> {
  const fonts = new Map<string, Font>();
  const fontDict = doc.dict(resources?.get('Font'));
  const xobjects = doc.dict(resources?.get('XObject'));
  let ctm = base;
  const stack: Matrix[] = [];
  let tm = IDENTITY;
  let tlm = IDENTITY;
  const text = {
    font: null as Font | null,
    size: 0,
    leading: 0,
    charSpace: 0,
    wordSpace: 0,
    scale: 1,
    rise: 0,
  };
  const show = (bytes: Uint8Array) => {
    if (!text.font || result.runs.length >= MAX_RUNS) return;
    const m = multiply(multiply([text.size * text.scale, 0, 0, text.size, 0, text.rise], tm), ctm);
    let advance = 0;
    let out = '';
    for (const glyph of text.font.decode(bytes)) {
      out += glyph.text;
      advance +=
        ((glyph.width / 1000) * text.size + text.charSpace + (glyph.space ? text.wordSpace : 0)) *
        text.scale;
    }
    const size = Math.hypot(m[2], m[3]);
    result.runs.push({
      x: m[4],
      y: m[5],
      width: advance * Math.hypot(ctm[0], ctm[1]) * Math.hypot(tm[0], tm[1]),
      size,
      bold: text.font.bold,
      text: out,
    });
    tm = multiply(translate(advance, 0), tm);
  };
  const nextLine = (x: number, y: number) => {
    tlm = multiply(translate(x, y), tlm);
    tm = tlm;
  };
  const lexer = new Lexer(data);
  let operands: PdfValue[] = [];
  for (;;) {
    const token = lexer.next();
    if (token === undefined) break;
    if (!(token instanceof Op)) {
      operands.push(token);
      continue;
    }
    const args = operands;
    operands = [];
    const n = (i: number) => (typeof args[i] === 'number' ? (args[i] as number) : 0);
    switch (token.op) {
      case 'q':
        stack.push(ctm);
        break;
      case 'Q':
        ctm = stack.pop() ?? ctm;
        break;
      case 'cm':
        ctm = multiply(asMatrix(args) ?? IDENTITY, ctm);
        break;
      case 'BT':
        tm = tlm = IDENTITY;
        break;
      case 'Tf': {
        const name = nameOf(args[0]) ?? '';
        if (!fonts.has(name)) fonts.set(name, await loadFont(doc, fontDict?.get(name)));
        text.font = fonts.get(name) ?? null;
        text.size = n(1);
        break;
      }
      case 'Tc':
        text.charSpace = n(0);
        break;
      case 'Tw':
        text.wordSpace = n(0);
        break;
      case 'Tz':
        text.scale = n(0) / 100;
        break;
      case 'TL':
        text.leading = n(0);
        break;
      case 'Ts':
        text.rise = n(0);
        break;
      case 'Td':
        nextLine(n(0), n(1));
        break;
      case 'TD':
        text.leading = -n(1);
        nextLine(n(0), n(1));
        break;
      case 'Tm':
        tm = tlm = asMatrix(args) ?? IDENTITY;
        break;
      case 'T*':
        nextLine(0, -text.leading);
        break;
      case "'":
      case '"':
        if (token.op === '"') [text.wordSpace, text.charSpace] = [n(0), n(1)];
        nextLine(0, -text.leading);
        if (args[args.length - 1] instanceof Uint8Array) show(args[args.length - 1] as Uint8Array);
        break;
      case 'Tj':
        if (args[0] instanceof Uint8Array) show(args[0]);
        break;
      case 'TJ':
        for (const item of Array.isArray(args[0]) ? args[0] : []) {
          if (item instanceof Uint8Array) show(item);
          else if (typeof item === 'number') {
            tm = multiply(translate((-item / 1000) * text.size * text.scale, 0), tm);
          }
        }
        break;
      case 'ID': {
        // Inline image data runs to "EI"; skip it without reading it as syntax.
        const end = findInlineImageEnd(data, lexer.pos);
        lexer.pos = end;
        result.images += 1;
        break;
      }
      case 'Do': {
        const object = doc.resolve(xobjects?.get(nameOf(args[0]) ?? ''));
        if (!(object instanceof Stream)) break;
        const subtype = nameOf(object.dict.get('Subtype'));
        if (subtype === 'Image') result.images += 1;
        if (subtype !== 'Form' || depth >= MAX_DEPTH) break;
        const formData = await doc.streamBytes(object).catch(() => null);
        if (!formData) break;
        const raw = doc.resolve(object.dict.get('Matrix'));
        const matrix = (Array.isArray(raw) && asMatrix(raw)) || IDENTITY;
        const formResources = doc.dict(object.dict.get('Resources')) ?? resources;
        await readContent(doc, formData, formResources, result, multiply(matrix, ctm), depth + 1);
        break;
      }
    }
  }
  return result;
}

function findInlineImageEnd(data: Uint8Array, from: number) {
  for (let i = from; i + 1 < data.length; i += 1) {
    const before = data[i - 1];
    if (data[i] === 69 && data[i + 1] === 73 && (before === 32 || before === 10 || before === 13)) {
      const after = data[i + 2];
      if (after === undefined || after === 32 || after === 10 || after === 13) return i + 2;
    }
  }
  return data.length;
}
