import { FileFormatError, readZipEntries, type InflateRaw } from './zip';

/**
 * The first sheet of an .xlsx file as rows of cells, enough for exported statements
 * (tradebooks): shared and inline strings, numbers and booleans. Formulas give their
 * stored result. Dates stay as stored: text, or a serial number.
 */
export type Cell = string | number | boolean | null;

const SHEET = 'xl/worksheets/sheet1.xml';
const STRINGS = 'xl/sharedStrings.xml';
const decoder = new TextDecoder();

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export const decodeXml = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const point =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });

/** Text of every <t> inside a fragment (plain or rich-text runs). */
const texts = (xml: string) =>
  decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

const attr = (attrs: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;

/** "BC12" → 54 (zero-based column). */
export function columnIndex(ref: string): number {
  let index = 0;
  for (const char of ref.replace(/[0-9]/g, '')) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

export function sheetRows(sheetXml: string, shared: string[]): Cell[][] {
  const rows: Cell[][] = [];
  const rowPattern = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  for (const row of sheetXml.matchAll(rowPattern)) {
    const number = Number(attr(row[1], 'r')) || rows.length + 1;
    const cells: Cell[] = [];
    let next = 0;
    for (const cell of (row[2] ?? '').matchAll(cellPattern)) {
      const ref = attr(cell[1], 'r');
      const column = ref ? columnIndex(ref) : next;
      next = column + 1;
      const body = cell[2] ?? '';
      const type = attr(cell[1], 't');
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: Cell = null;
      if (type === 'inlineStr') value = texts(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? '');
      else if (raw === undefined) value = null;
      else if (type === 's') value = shared[Number(raw)] ?? null;
      else if (type === 'str' || type === 'e') value = decodeXml(raw);
      else if (type === 'b') value = raw === '1';
      else value = Number.isFinite(Number(raw)) ? Number(raw) : decodeXml(raw);
      cells[column] = value;
    }
    rows[number - 1] = Array.from(cells, (value) => value ?? null);
  }
  return Array.from(rows, (row) => row ?? []);
}

export async function readXlsxRows(bytes: Uint8Array, inflateRaw: InflateRaw): Promise<Cell[][]> {
  const entries = await readZipEntries(bytes, [SHEET, STRINGS], inflateRaw);
  const sheet = entries.get(SHEET);
  if (!sheet) throw new FileFormatError('The workbook has no first sheet.');
  const stringsXml = entries.has(STRINGS) ? decoder.decode(entries.get(STRINGS)) : '';
  const shared = [...stringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  return sheetRows(decoder.decode(sheet), shared);
}
