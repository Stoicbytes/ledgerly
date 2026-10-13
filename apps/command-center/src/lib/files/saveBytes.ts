/**
 * Phones: saving a binary file (a PDF or Word CV) needs a file module the app does not
 * include yet, so the download is offered in the web app only and the screen says so.
 */
export async function saveBytes(
  _bytes: Uint8Array,
  _fileName: string,
  _type: string,
): Promise<void> {
  throw new Error('Downloading files works in the web app.');
}

export const canSaveBytes = false;
