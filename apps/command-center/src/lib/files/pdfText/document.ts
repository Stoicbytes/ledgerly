import { openEncryption, type Decrypt, type Subtle } from './security';
import { binaryString, Dict, Lexer, nameOf, numberOf, Ref, Stream, type PdfValue } from './syntax';

/** zlib inflate that stops past `maxBytes` (DecompressionStream in the app, zlib in tests). */
export type Inflate = (data: Uint8Array, maxBytes: number) => Promise<Uint8Array>;

export class PasswordNeeded extends Error {
  constructor(readonly wrong: boolean) {
    super(wrong ? 'Wrong password' : 'Password needed');
  }
}
export class NotPdf extends Error {}

/** No stream may expand past this: a crafted file must not freeze the tab. */
export const MAX_STREAM_BYTES = 20 * 1024 * 1024;

/**
 * A PDF opened for reading text. Objects are found by scanning the file (which also copes
 * with damaged cross-reference tables) and inside object streams; streams are decrypted and
 * decompressed when asked for.
 */
export class PdfDocument {
  private objects = new Map<number, PdfValue>();
  private decrypt: Decrypt | null = null;
  trailer = new Dict();

  private constructor(
    private bytes: Uint8Array,
    private inflate: Inflate,
  ) {}

  static async open(bytes: Uint8Array, inflate: Inflate, password: string, subtle?: Subtle) {
    const doc = new PdfDocument(bytes, inflate);
    if (binaryString(bytes.subarray(0, 1024)).indexOf('%PDF-') < 0) throw new NotPdf();
    doc.scan();
    const encrypt = doc.resolve(doc.trailer.get('Encrypt'));
    if (encrypt instanceof Dict) {
      const ids = doc.trailer.get('ID');
      const id = Array.isArray(ids) && ids[0] instanceof Uint8Array ? ids[0] : new Uint8Array();
      doc.decrypt = await openEncryption(encrypt, id, password, subtle);
      if (!doc.decrypt) throw new PasswordNeeded(password !== '');
    }
    await doc.unpackObjectStreams();
    return doc;
  }

  private scan() {
    const text = binaryString(this.bytes);
    const header = /(\d+)\s+(\d+)\s+obj\b/g;
    let match: RegExpExecArray | null;
    while ((match = header.exec(text))) {
      if (match.index > 0 && /[^\s]/.test(text[match.index - 1])) continue;
      const lexer = new Lexer(this.bytes, match.index + match[0].length);
      let value: PdfValue | undefined;
      try {
        value = lexer.next();
      } catch {
        continue;
      }
      const num = Number(match[1]);
      const gen = Number(match[2]);
      if (value instanceof Dict && lexer.peekWord() === 'stream') {
        const stream = this.readStream(text, value, lexer.pos + 6, num, gen);
        value = stream;
        header.lastIndex = stream.raw.byteOffset - this.bytes.byteOffset + stream.raw.length;
      } else header.lastIndex = lexer.pos;
      this.objects.set(num, value ?? null);
      if (value instanceof Stream && nameOf(value.dict.get('Type')) === 'XRef')
        this.addTrailer(value.dict);
    }
    for (const at of text.matchAll(/trailer\s*<</g)) {
      const value = new Lexer(this.bytes, (at.index ?? 0) + 7).next();
      if (value instanceof Dict) this.addTrailer(value);
    }
  }

  private addTrailer(dict: Dict) {
    for (const key of ['Root', 'Encrypt', 'ID']) {
      const value = dict.get(key);
      if (value !== undefined) this.trailer.map.set(key, value);
    }
  }

  private readStream(text: string, dict: Dict, after: number, num: number, gen: number) {
    let start = after;
    if (this.bytes[start] === 13) start += 1;
    if (this.bytes[start] === 10) start += 1;
    const length = numberOf(dict.get('Length'));
    let end =
      length !== null &&
      length >= 0 &&
      /^\s*endstream/.test(text.slice(start + length, start + length + 20))
        ? start + length
        : text.indexOf('endstream', start);
    if (end < 0) end = this.bytes.length;
    return new Stream(dict, this.bytes.subarray(start, end), num, gen);
  }

  private async unpackObjectStreams() {
    for (const [num, value] of [...this.objects]) {
      if (!(value instanceof Stream) || nameOf(value.dict.get('Type')) !== 'ObjStm') continue;
      const data = await this.streamBytes(value).catch(() => null);
      if (!data) continue;
      const first = numberOf(value.dict.get('First')) ?? 0;
      const lexer = new Lexer(data);
      const count = Math.min(numberOf(value.dict.get('N')) ?? 0, 100_000);
      const entries: [number, number][] = [];
      for (let i = 0; i < count; i += 1) {
        const id = lexer.next();
        const offset = lexer.next();
        if (typeof id === 'number' && typeof offset === 'number') entries.push([id, offset]);
      }
      for (const [id, offset] of entries) {
        if (this.objects.has(id) || id === num) continue;
        try {
          this.objects.set(id, new Lexer(data, first + offset).next() ?? null);
        } catch {
          // A damaged entry is skipped; the rest of the document may still read.
        }
      }
    }
  }

  resolve(value: PdfValue | undefined, depth = 0): PdfValue | undefined {
    if (value instanceof Ref && depth < 16)
      return this.resolve(this.objects.get(value.num), depth + 1);
    return value;
  }

  dict(value: PdfValue | undefined): Dict | null {
    const resolved = this.resolve(value);
    return resolved instanceof Dict ? resolved : resolved instanceof Stream ? resolved.dict : null;
  }

  /** A stream's data: decrypted and decompressed (FlateDecode); other filters are refused. */
  async streamBytes(stream: Stream): Promise<Uint8Array> {
    let data = stream.raw;
    if (this.decrypt && nameOf(stream.dict.get('Type')) !== 'XRef') {
      data = await this.decrypt(data, stream.num, stream.gen);
    }
    const filter = this.resolve(stream.dict.get('Filter'));
    const filters = (Array.isArray(filter) ? filter : filter ? [filter] : []).map(nameOf);
    for (const name of filters) {
      if (name === 'FlateDecode' || name === 'Fl')
        data = await this.inflate(data, MAX_STREAM_BYTES);
      else throw new Error(`Unsupported filter ${name}`);
    }
    return data;
  }
}
