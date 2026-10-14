import { deflateRawSync, inflateRawSync } from 'zlib';
import { inflateRaw } from '../inflate';
import { MAX_COLUMNS, MAX_ROWS, sheetRows } from '../xlsx';
import { FileFormatError, MAX_ENTRY_BYTES, readZipEntries } from '../zip';

const SHEET = 'xl/worksheets/sheet1.xml';

/** A one-entry zip with a deflated entry; `stated` is the size the directory claims. */
function deflatedZip(name: string, content: Uint8Array, stated = content.length): Uint8Array {
  const packed = new Uint8Array(deflateRawSync(content));
  const nameBytes = new TextEncoder().encode(name);
  const local = new Uint8Array(30 + nameBytes.length + packed.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, 8, true);
  lv.setUint32(18, packed.length, true);
  lv.setUint32(22, stated, true);
  lv.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  local.set(packed, 30 + nameBytes.length);
  const central = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, 8, true);
  cv.setUint32(20, packed.length, true);
  cv.setUint32(24, stated, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint32(42, 0, true);
  central.set(nameBytes, 46);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true);
  const out = new Uint8Array(local.length + central.length + end.length);
  out.set(local, 0);
  out.set(central, local.length);
  out.set(end, local.length + central.length);
  return out;
}

const nodeInflate = jest.fn(async (data: Uint8Array) => new Uint8Array(inflateRawSync(data)));
const huge = new Uint8Array(MAX_ENTRY_BYTES + 1024);

describe('zip size limits', () => {
  beforeEach(() => nodeInflate.mockClear());

  it('reads a normal entry, passing the size limit to the inflater', async () => {
    const zip = deflatedZip(SHEET, new TextEncoder().encode('<row r="1"/>'));
    const entries = await readZipEntries(zip, [SHEET], nodeInflate);
    expect(new TextDecoder().decode(entries.get(SHEET))).toBe('<row r="1"/>');
    expect(nodeInflate).toHaveBeenCalledWith(expect.any(Uint8Array), MAX_ENTRY_BYTES);
  });

  it('refuses an entry that says it unpacks to more than 50 MB, without inflating it', async () => {
    const zip = deflatedZip(SHEET, huge);
    await expect(readZipEntries(zip, [SHEET], nodeInflate)).rejects.toBeInstanceOf(FileFormatError);
    expect(nodeInflate).not.toHaveBeenCalled();
  });

  it('refuses an entry whose stated size lies', async () => {
    const zip = deflatedZip(SHEET, huge, 100);
    await expect(readZipEntries(zip, [SHEET], nodeInflate)).rejects.toThrow(/too large/);
  });
});

describe('inflateRaw', () => {
  const packed = new Uint8Array(deflateRawSync(new Uint8Array(4096).fill(7)));

  it('inflates within the limit', async () => {
    const out = await inflateRaw(packed, 4096);
    expect(out).toHaveLength(4096);
    expect(out[4095]).toBe(7);
  });

  it('stops as soon as the output passes the limit', async () => {
    await expect(inflateRaw(packed, 1000)).rejects.toThrow(/too large/);
  });
});

describe('sheet size limits', () => {
  it('refuses row numbers past the limit', () => {
    expect(() => sheetRows(`<row r="${MAX_ROWS + 1}"><c r="A1"><v>1</v></c></row>`, [])).toThrow(
      FileFormatError,
    );
    expect(sheetRows(`<row r="${MAX_ROWS}"/>`, [])).toHaveLength(MAX_ROWS);
  });

  it('refuses columns past the limit', () => {
    expect(() => sheetRows('<row r="1"><c r="ZZ1"><v>1</v></c></row>', [])).toThrow(/too large/);
    const last = sheetRows('<row r="1"><c r="GR1"><v>1</v></c></row>', []);
    expect(last[0]).toHaveLength(MAX_COLUMNS);
  });
});
