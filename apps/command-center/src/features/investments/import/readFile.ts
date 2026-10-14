import { readTradebook, type TradebookRead } from '@/lib/domain/investments/tradebookImport';
import type { PickedFile } from './pickFiles';

/** One chosen file → its trades (on this device; the file is not kept or uploaded). */
export async function readTradebookFile(file: PickedFile): Promise<TradebookRead> {
  const { readSpreadsheet } = await import('@/lib/files/spreadsheet');
  const read = await readSpreadsheet(file.name, file.bytes);
  if ('problem' in read) return { trades: [], problems: [`${file.name}: ${read.problem}`] };
  return readTradebook(read.rows, file.name);
}
