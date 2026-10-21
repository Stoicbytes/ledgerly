import { readFileSync } from 'fs';
import { join } from 'path';
import { constants, inflateSync } from 'zlib';
import { extractPdfText, NotPdf, PasswordNeeded, type TextLine } from '..';
import { md5, rc4 } from '../md5';
import { parseToUnicode } from '../fonts';

const FIXTURES = join(__dirname, '../../../domain/salary/payslipImport/__fixtures__');
const fixture = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)));
const inflate = async (data: Uint8Array) =>
  new Uint8Array(inflateSync(data, { finishFlush: constants.Z_SYNC_FLUSH }));
const options = { inflate, subtle: globalThis.crypto.subtle };
const text = (pages: TextLine[][]) =>
  pages.flat().map((line) => line.words.map((word) => word.text).join(' '));

describe('extractPdfText', () => {
  it('reads compressed text in reading order, line by line', async () => {
    const { pages } = await extractPdfText(fixture('payslip-two-column.pdf'), options);
    const lines = text(pages);
    expect(lines[0]).toBe('Example Technologies Pvt Ltd');
    expect(lines).toContain('Basic 50,000.00 Provident Fund 1,800.00');
    expect(lines).toContain('Net Pay: Rs. 77,400.50');
    const heading = pages[0][0].words[0];
    expect(heading).toMatchObject({ bold: true, size: 16 });
    const basic = pages[0].find((line) => line.words[0].text === 'Basic')!;
    const x = (text: string) => Math.round(basic.words.find((word) => word.text === text)!.x);
    expect(['Basic', '50,000.00', 'Provident', '1,800.00'].map(x)).toEqual([40, 205, 300, 480]);
  });

  it('maps two-byte codes through the ToUnicode map (₹ included)', async () => {
    const lines = text((await extractPdfText(fixture('payslip-label-value.pdf'), options)).pages);
    expect(lines).toContain('Basic Salary: ₹ 1,23,456.00');
    expect(lines).toContain('Net Salary: ₹ 1,28,323.00');
  });

  it('finds objects inside object streams and joins kerned pieces', async () => {
    const lines = text((await extractPdfText(fixture('payslip-ytd.pdf'), options)).pages);
    expect(lines).toContain("Salary slip for Jul'26");
    expect(lines).toContain('Basic 40,000.00 1,60,000.00');
  });

  it('reads text drawn inside a form XObject', async () => {
    const lines = text((await extractPdfText(fixture('payslip-employer-pf.pdf'), options)).pages);
    expect(lines).toContain('Pension Fund (EPS): Rs. 1,250.00');
  });

  it('counts images on a page without text (a scan)', async () => {
    const result = await extractPdfText(fixture('payslip-scanned.pdf'), options);
    expect(result.pages.flat()).toHaveLength(0);
    expect(result.images).toBe(1);
  });

  it.each([
    ['payslip-aes256.pdf', 'Basic 50,000.00 Provident Fund 1,800.00'],
    ['payslip-aes128.pdf', 'Basic Salary: ₹ 1,23,456.00'],
    ['payslip-rc4.pdf', 'Basic 40,000.00 1,60,000.00'],
  ])('opens %s with its password and only with it', async (name, line) => {
    const bytes = fixture(name);
    await expect(extractPdfText(bytes, options)).rejects.toEqual(new PasswordNeeded(false));
    await expect(extractPdfText(bytes, { ...options, password: 'wrong' })).rejects.toMatchObject({
      wrong: true,
    });
    const { pages } = await extractPdfText(bytes, { ...options, password: 'sample-pass' });
    expect(text(pages)).toContain(line);
  });

  it('refuses files that are not PDFs', async () => {
    await expect(
      extractPdfText(new TextEncoder().encode('Basic,45000'), options),
    ).rejects.toBeInstanceOf(NotPdf);
  });
});

describe('building blocks', () => {
  it('md5 and rc4 match known vectors', () => {
    const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
    expect(hex(md5(new Uint8Array()))).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(hex(md5(new TextEncoder().encode('The quick brown fox jumps over the lazy dog')))).toBe(
      '9e107d9d372bb6826bd81d3542a419d6',
    );
    const key = new TextEncoder().encode('Key');
    expect(hex(rc4(key, new TextEncoder().encode('Plaintext')))).toBe('bbf316e8d940af0ad3');
  });

  it('parses bfchar and both kinds of bfrange', () => {
    const { map, bytes } = parseToUnicode(
      '1 begincodespacerange <0000> <FFFF> endcodespacerange\n' +
        '1 beginbfchar <0003> <20B9> endbfchar\n' +
        '2 beginbfrange <0010> <0012> <0041> <0020> <0021> [<0031> <0032>] endbfrange',
    );
    expect(bytes).toBe(2);
    expect([3, 0x10, 0x11, 0x12, 0x20, 0x21].map((code) => map.get(code)).join('')).toBe('₹ABC12');
  });
});
