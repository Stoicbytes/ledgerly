import type { PickedFile, PickOptions } from './pickFiles';

export type { PickedFile, PickOptions } from './pickFiles';

export const canPickFiles = true;

const MAX_BYTES = 5 * 1024 * 1024;
const SHEETS =
  '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Opens the file chooser; resolves with the chosen files (none when all were over the
 * limit, 5 MB unless given), or null if cancelled.
 */
export function pickFiles({
  accept = SHEETS,
  maxBytes = MAX_BYTES,
  multiple = true,
}: PickOptions = {}): Promise<PickedFile[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.accept = accept;
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', async () => {
      const chosen = Array.from(input.files ?? []);
      if (!chosen.length) return resolve(null);
      // Files over the limit are dropped; an empty list says every chosen file was too large.
      const files = chosen.filter((file) => file.size <= maxBytes);
      resolve(
        await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
          })),
        ),
      );
    });
    input.click();
  });
}
