import { readCsvRows } from './csv';
import { inflateRaw } from './inflate';
import { readXlsxRows, type Cell } from './xlsx';
import { FileFormatError } from './zip';

/**
 * A chosen .csv or .xlsx file as rows of cells, or why it could not be read. Loaded with
 * import() only when a file is chosen, so the readers are not in the first download.
 */
export async function readSpreadsheet(
  name: string,
  bytes: Uint8Array,
): Promise<{ rows: Cell[][] } | { problem: string }> {
  try {
    const rows = /\.csv$/i.test(name)
      ? readCsvRows(new TextDecoder().decode(bytes))
      : await readXlsxRows(bytes, inflateRaw);
    return { rows };
  } catch (error) {
    return {
      problem: error instanceof FileFormatError ? error.message : 'It could not be read.',
    };
  }
}
