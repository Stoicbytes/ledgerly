import type { Picked, PreparedFile, PreparedImage } from './media';

export type { Picked, PreparedFile, PreparedImage } from './media';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const canPickPdf = true;

const FULL_WIDTH = 1600;
const SMALL_WIDTH = 640;

function choose(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.click();
  });
}

async function encode(bitmap: ImageBitmap, width: number): Promise<Blob | null> {
  const scale = Math.min(1, width / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
}

/**
 * Opens the file chooser and prepares the image in the browser: at most 1600 px wide,
 * plus a 640 px copy for phones, re-encoded as WebP (which also drops camera and
 * location metadata). Nothing is uploaded until the form is saved.
 */
export async function pickImage(): Promise<Picked<PreparedImage>> {
  const file = await choose('image/jpeg,image/png,image/webp,image/avif');
  if (!file) return null;
  if (file.size > 25 * 1024 * 1024) return { error: 'That image is too large (over 25 MB).' };
  try {
    const bitmap = await createImageBitmap(file);
    const full = await encode(bitmap, FULL_WIDTH);
    const small = bitmap.width > SMALL_WIDTH + 100 ? await encode(bitmap, SMALL_WIDTH) : null;
    const scale = Math.min(1, FULL_WIDTH / bitmap.width);
    const prepared = {
      width: Math.round(bitmap.width * scale),
      height: Math.round(bitmap.height * scale),
    };
    bitmap.close();
    if (!full || full.type !== 'image/webp')
      return { error: 'This browser cannot prepare images. Try another browser.' };
    if (full.size > MAX_UPLOAD_BYTES)
      return { error: 'The image is still over 5 MB after resizing.' };
    return {
      full,
      small: small?.type === 'image/webp' ? small : null,
      ...prepared,
      type: 'image/webp',
      ext: 'webp',
    };
  } catch {
    return { error: 'Could not read that image.' };
  }
}

export async function pickPdf(): Promise<Picked<PreparedFile>> {
  const file = await choose('application/pdf');
  if (!file) return null;
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'The PDF can be up to 5 MB.' };
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== '%PDF-') return { error: 'That file is not a PDF.' };
  return { blob: file, name: file.name.slice(0, 120) || 'Résumé.pdf', size: file.size };
}
