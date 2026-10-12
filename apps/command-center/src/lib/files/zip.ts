/**
 * Reads named entries from a .zip archive (an .xlsx file is one). Only what spreadsheets
 * use: stored or deflated entries, sizes from the central directory. Inflating is passed
 * in, so the browser's built-in decompressor (or Node's in tests) does the work and no
 * library is bundled.
 */
export type InflateRaw = (data: Uint8Array) => Promise<Uint8Array>;

export class FileFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileFormatError';
  }
}

const decoder = new TextDecoder();

export async function readZipEntries(
  bytes: Uint8Array,
  names: readonly string[],
  inflateRaw: InflateRaw,
): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (at: number) => (at + 4 <= bytes.length ? view.getUint32(at, true) : -1);
  const u16 = (at: number) => view.getUint16(at, true);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at -= 1) {
    if (u32(at) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new FileFormatError('This is not an .xlsx (zip) file.');
  const count = u16(end + 10);
  let at = view.getUint32(end + 16, true);
  const found = new Map<string, Uint8Array>();
  for (let entry = 0; entry < count; entry += 1) {
    if (u32(at) !== 0x02014b50) throw new FileFormatError('The file is damaged.');
    const method = u16(at + 10);
    const size = view.getUint32(at + 20, true);
    const nameLength = u16(at + 28);
    const skip = nameLength + u16(at + 30) + u16(at + 32);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + skip;
    if (!names.includes(name)) continue;
    if (u32(local) !== 0x04034b50) throw new FileFormatError('The file is damaged.');
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    const data = bytes.subarray(start, start + size);
    if (method === 0) found.set(name, data);
    else if (method === 8) found.set(name, await inflateRaw(data));
    else throw new FileFormatError('The file uses a compression this app cannot read.');
  }
  return found;
}
