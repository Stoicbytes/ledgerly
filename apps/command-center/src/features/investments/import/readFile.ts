import { readTradebook, type TradebookRead } from '@/lib/domain/investments';
import { readCsvRows } from '@/lib/files/csv';
import { inflateRaw } from '@/lib/files/inflate';
import { readXlsxRows } from '@/lib/files/xlsx';
import { FileFormatError } from '@/lib/files/zip';
import type { PickedFile } from './pickFiles';

/** One chosen file → its trades (on this device; the file is not kept or uploaded). */
export async function readTradebookFile(file: PickedFile): Promise<TradebookRead> {
  try {
    const rows = /\.csv$/i.test(file.name)
      ? readCsvRows(new TextDecoder().decode(file.bytes))
      : await readXlsxRows(file.bytes, inflateRaw);
    return readTradebook(rows, file.name);
  } catch (error) {
    const reason = error instanceof FileFormatError ? error.message : 'It could not be read.';
    return { trades: [], problems: [`${file.name}: ${reason}`] };
  }
}
