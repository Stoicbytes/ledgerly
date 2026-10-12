import { readFileSync } from 'fs';
import { join } from 'path';
import { inflateRawSync } from 'zlib';
import { readCsvRows } from '../csv';
import { columnIndex, decodeXml, readXlsxRows, sheetRows } from '../xlsx';
import { FileFormatError } from '../zip';

const inflate = async (data: Uint8Array) => new Uint8Array(inflateRawSync(data));
const sample = new Uint8Array(
  readFileSync(join(__dirname, '../__fixtures__/tradebook-sample.xlsx')),
);

describe('readXlsxRows', () => {
  it('reads shared strings, numbers and booleans by column', async () => {
    const rows = await readXlsxRows(sample, inflate);
    expect(rows[1][1]).toBe('Tradebook for Equity from 2026-01-01 to 2026-03-31');
    const header = rows.findIndex((row) => row.includes('Symbol'));
    expect(rows[header].slice(1, 4)).toEqual(['Symbol', 'ISIN', 'Trade Date']);
    expect(rows[header + 1].slice(1, 11)).toEqual([
      'SAMPLEBEES',
      'INF000S01011',
      '2026-01-05',
      'NSE',
      'EQ',
      'EQ',
      'buy',
      false,
      10,
      51.25,
    ]);
    expect(rows[header + 3][1]).toBe('M&M SAMPLE');
  });

  it('refuses files that are not spreadsheets', async () => {
    await expect(readXlsxRows(new Uint8Array([1, 2, 3]), inflate)).rejects.toBeInstanceOf(
      FileFormatError,
    );
  });
});

describe('sheet parsing', () => {
  it('handles empty rows, inline strings and entities', () => {
    const xml =
      '<sheetData><row r="1"/><row r="3"><c r="B3" t="inlineStr"><is><t>A &amp; B</t></is></c>' +
      '<c r="D3"><v>4.5</v></c><c r="E3" t="s"><v>0</v></c><c r="F3"/></row></sheetData>';
    const rows = sheetRows(xml, ['shared']);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual([]);
    expect(rows[2]).toEqual([null, 'A & B', null, 4.5, 'shared', null]);
  });

  it('maps column letters and decodes entities', () => {
    expect(columnIndex('A1')).toBe(0);
    expect(columnIndex('AA10')).toBe(26);
    expect(decodeXml('&lt;x&gt; &#65;&#x42;')).toBe('<x> AB');
  });
});

describe('readCsvRows', () => {
  it('reads quoted fields, doubled quotes and CRLF', () => {
    expect(readCsvRows('Symbol,Price\r\n"M&M, Ltd",12.5\n"say ""hi""",3')).toEqual([
      ['Symbol', 'Price'],
      ['M&M, Ltd', '12.5'],
      ['say "hi"', '3'],
    ]);
  });
});
