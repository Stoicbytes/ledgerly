/**
 * PDF object syntax (ISO 32000 §7.3) read straight from bytes: numbers, names, strings,
 * arrays, dictionaries, references and content-stream operators. Just enough to find the
 * text in a document; nothing is ever executed.
 */
export class Name {
  constructor(readonly name: string) {}
}
export class Ref {
  constructor(
    readonly num: number,
    readonly gen: number,
  ) {}
}
/** A content-stream operator such as Tj or BT. */
export class Op {
  constructor(readonly op: string) {}
}
export class Dict {
  constructor(readonly map = new Map<string, PdfValue>()) {}
  get(key: string): PdfValue | undefined {
    return this.map.get(key);
  }
}
export class Stream {
  constructor(
    readonly dict: Dict,
    /** The raw (still encoded, maybe encrypted) bytes. */
    readonly raw: Uint8Array,
    readonly num: number,
    readonly gen: number,
  ) {}
}
export type PdfValue =
  number | boolean | null | Uint8Array | Name | Ref | Op | Dict | Stream | PdfValue[];

const isSpace = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
// ( ) < > [ ] { } / %
const DELIMITERS = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);
const isRegular = (c: number) => !isSpace(c) && !DELIMITERS.has(c);
const ESCAPES: Record<number, number> = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12 };
const hexValue = (c: number) =>
  c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1;

/** Reads PDF objects one after another from `bytes`, starting at `pos`. */
export class Lexer {
  constructor(
    readonly bytes: Uint8Array,
    public pos = 0,
  ) {}

  skipSpace() {
    const { bytes } = this;
    while (this.pos < bytes.length) {
      const c = bytes[this.pos];
      if (isSpace(c)) this.pos += 1;
      else if (c === 37)
        while (this.pos < bytes.length && bytes[this.pos] !== 10 && bytes[this.pos] !== 13)
          this.pos += 1;
      else break;
    }
  }

  /** A run of regular characters (a number or keyword), without moving past it. */
  peekWord(): string {
    this.skipSpace();
    let end = this.pos;
    while (end < this.bytes.length && isRegular(this.bytes[end])) end += 1;
    return String.fromCharCode(...this.bytes.subarray(this.pos, end));
  }

  private word(): string {
    const text = this.peekWord();
    this.pos += text.length;
    return text;
  }

  private literal(): Uint8Array {
    const { bytes } = this;
    const out: number[] = [];
    let depth = 1;
    this.pos += 1;
    while (this.pos < bytes.length) {
      const c = bytes[this.pos++];
      if (c === 40) depth += 1;
      else if (c === 41 && --depth === 0) break;
      if (c !== 92) {
        out.push(c);
        continue;
      }
      const next = bytes[this.pos++];
      if (ESCAPES[next] !== undefined) out.push(ESCAPES[next]);
      else if (next >= 48 && next <= 55) {
        let code = next - 48;
        for (let i = 0; i < 2 && bytes[this.pos] >= 48 && bytes[this.pos] <= 55; i += 1) {
          code = code * 8 + bytes[this.pos++] - 48;
        }
        out.push(code & 0xff);
      } else if (next === 13) {
        if (bytes[this.pos] === 10) this.pos += 1;
      } else if (next !== 10) out.push(next);
    }
    return Uint8Array.from(out);
  }

  private hex(): Uint8Array {
    const out: number[] = [];
    let high = -1;
    this.pos += 1;
    while (this.pos < this.bytes.length) {
      const c = this.bytes[this.pos++];
      if (c === 62) break;
      const value = hexValue(c);
      if (value < 0) continue;
      if (high < 0) high = value;
      else {
        out.push(high * 16 + value);
        high = -1;
      }
    }
    if (high >= 0) out.push(high * 16);
    return Uint8Array.from(out);
  }

  private name(): Name {
    this.pos += 1;
    const raw = this.word();
    return new Name(
      raw.replace(/#([0-9a-f]{2})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16))),
    );
  }

  /** The next object; `undefined` at the end, `Op` for keywords and closing brackets. */
  next(depth = 0): PdfValue | undefined {
    if (depth > 64) throw new Error('Nesting too deep');
    this.skipSpace();
    const { bytes } = this;
    if (this.pos >= bytes.length) return undefined;
    const c = bytes[this.pos];
    if (c === 40) return this.literal();
    if (c === 47) return this.name();
    if (c === 60 && bytes[this.pos + 1] === 60) {
      this.pos += 2;
      const dict = new Dict();
      for (;;) {
        const key = this.next(depth + 1);
        if (key === undefined || (key instanceof Op && key.op === '>>')) return dict;
        if (!(key instanceof Name)) continue;
        const value = this.next(depth + 1);
        if (value === undefined || (value instanceof Op && value.op === '>>')) return dict;
        dict.map.set(key.name, value);
      }
    }
    if (c === 60) return this.hex();
    if (c === 62 && bytes[this.pos + 1] === 62) {
      this.pos += 2;
      return new Op('>>');
    }
    if (c === 91) {
      this.pos += 1;
      const items: PdfValue[] = [];
      for (;;) {
        const item = this.next(depth + 1);
        if (item === undefined || (item instanceof Op && item.op === ']')) return items;
        items.push(item);
      }
    }
    if (!isRegular(c)) {
      this.pos += 1;
      return new Op(String.fromCharCode(c));
    }
    const word = this.word();
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      // "12 0 R" is a reference.
      if (/^\d+$/.test(word)) {
        const save = this.pos;
        const gen = this.peekWord();
        if (/^\d+$/.test(gen)) {
          this.pos += gen.length;
          if (this.peekWord() === 'R') {
            this.pos += 1;
            return new Ref(Number(word), Number(gen));
          }
        }
        this.pos = save;
      }
      return Number(word);
    }
    if (word === 'true' || word === 'false') return word === 'true';
    if (word === 'null') return null;
    return new Op(word);
  }
}

/** Bytes as a string of 8-bit characters, so offsets match (for searching). */
export function binaryString(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return out;
}

export const nameOf = (value: PdfValue | undefined) => (value instanceof Name ? value.name : null);
export const numberOf = (value: PdfValue | undefined) => (typeof value === 'number' ? value : null);
