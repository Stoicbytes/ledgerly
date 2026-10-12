import type { Photo } from '@/lib/domain/expenses';
import type { ReceiptFile } from './receiptFile';

export type { ReceiptFile } from './receiptFile';

const MAX_SIDE = 2000;

/**
 * Re-encodes the photo in the browser as WebP, at most 2000 px on its longer side. This
 * drops the camera and location data a photo file can carry, and makes it smaller. A
 * format the browser cannot draw (HEIC in most browsers) is uploaded as it is.
 */
export async function receiptFile(photo: Photo): Promise<ReceiptFile> {
  const original = await (await fetch(photo.uri)).blob();
  const fallback = {
    blob: original,
    mimeType: photo.mimeType.toLowerCase(),
    width: photo.width,
    height: photo.height,
  };
  try {
    const bitmap = await createImageBitmap(original);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85),
    );
    if (!blob || blob.type !== 'image/webp') return fallback;
    return { blob, mimeType: 'image/webp', width: canvas.width, height: canvas.height };
  } catch {
    return fallback;
  }
}
