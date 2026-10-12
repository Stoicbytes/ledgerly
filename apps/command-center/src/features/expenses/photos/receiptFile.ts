import type { Photo } from '@/lib/domain/expenses';

/** The file to upload with its type and size in pixels. */
export type ReceiptFile = { blob: Blob; mimeType: string; width: number; height: number };

/**
 * Phones: the picked file as it is. The picker already re-compresses it (quality 0.7)
 * and is asked for no location data. The web version re-encodes it in the browser.
 */
export async function receiptFile(photo: Photo): Promise<ReceiptFile> {
  const blob = await (await fetch(photo.uri)).blob();
  return {
    blob,
    mimeType: photo.mimeType.toLowerCase(),
    width: photo.width,
    height: photo.height,
  };
}
