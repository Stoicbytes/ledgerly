/**
 * A receipt photo attached to a transaction. Signed in, it is uploaded to the private
 * `receipts` bucket as soon as it is picked (`path`) and shown through links that expire
 * after a minute; `uri` is the picked file, known only on the device that picked it.
 * In the preview it lives in memory only (no `path`). Pickers ask for no location data.
 */
export type Photo = {
  /** The picked file on this device, or '' for a photo loaded from the cloud. */
  uri: string;
  /** Where it is stored: "<user id>/<uuid>.<ext>" in the `receipts` bucket. */
  path?: string | null;
  width: number;
  height: number;
  mimeType: string;
  bytes: number;
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** File extension for a photo type (the database accepts only these). */
export const photoExtension = (mimeType: string) => EXTENSIONS[mimeType.toLowerCase()] ?? 'jpg';

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = Object.keys(EXTENSIONS);

/** Why a picked file cannot be attached, or null. */
export function photoError(mimeType: string | null | undefined, bytes: number): string | null {
  if (!mimeType || !PHOTO_TYPES.includes(mimeType.toLowerCase())) {
    return 'Choose a photo (JPEG, PNG, WebP or HEIC).';
  }
  if (bytes > PHOTO_MAX_BYTES) return 'That photo is larger than 10 MB.';
  return null;
}

/** Size of a `data:` URL's payload in bytes (web pickers do not always report it). */
export function dataUrlBytes(uri: string): number {
  const comma = uri.indexOf(',');
  if (!uri.startsWith('data:') || comma < 0) return 0;
  const payload = uri.slice(comma + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}
