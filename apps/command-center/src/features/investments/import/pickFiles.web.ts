import type { PickedFile } from './pickFiles';

export type { PickedFile } from './pickFiles';

export const canPickFiles = true;

const MAX_BYTES = 5 * 1024 * 1024;

/** Opens the browser's file chooser; resolves with the chosen files, or null if cancelled. */
export function pickFiles(): Promise<PickedFile[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept =
      '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', async () => {
      const files = Array.from(input.files ?? []).filter((file) => file.size <= MAX_BYTES);
      if (!files.length) return resolve(null);
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
