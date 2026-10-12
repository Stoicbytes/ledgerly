import type { Photo } from '@/lib/domain/expenses';

/** `transactions.receipt` (migration 0011) to and from the app's photo. */
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** A stored receipt (migration 0011) as a photo; the picture itself is fetched on demand. */
export function receiptPhoto(value: unknown): Photo | null {
  if (!value || typeof value !== 'object') return null;
  const receipt = value as Record<string, unknown>;
  if (!str(receipt.path)) return null;
  return {
    uri: '',
    path: str(receipt.path),
    width: num(receipt.width),
    height: num(receipt.height),
    mimeType: str(receipt.mime_type),
    bytes: num(receipt.bytes),
  };
}

// Only a stored photo is saved (in the preview, photos stay in memory).
export const receiptRow = (photo: Photo | null | undefined) =>
  photo?.path
    ? {
        path: photo.path,
        width: photo.width,
        height: photo.height,
        mime_type: photo.mimeType,
        bytes: photo.bytes,
      }
    : null;
