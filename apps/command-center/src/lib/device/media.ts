import * as ImagePicker from 'expo-image-picker';

/**
 * Choosing images and the résumé for the portfolio. Phones: the system photo library
 * (JPEG/PNG, compressed, no location data); PDFs are added from the web app for now.
 * The web version (media.web.ts) resizes and converts images in the browser.
 */
export type PreparedImage = {
  full: Blob;
  small: Blob | null;
  width: number;
  height: number;
  type: string;
  ext: 'webp' | 'jpg' | 'png';
};
export type PreparedFile = { blob: Blob; name: string; size: number };
export type Picked<T> = T | { error: string } | null;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const canPickPdf = false;

export async function pickImage(): Promise<Picked<PreparedImage>> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      exif: false,
      allowsMultipleSelection: false,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return null;
    const type = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await (await fetch(asset.uri)).blob();
    if (blob.size > MAX_UPLOAD_BYTES) return { error: 'Images can be up to 5 MB.' };
    return {
      full: blob,
      small: null,
      width: asset.width,
      height: asset.height,
      type,
      ext: type === 'image/png' ? 'png' : 'jpg',
    };
  } catch {
    return { error: 'Could not open the image. Try again.' };
  }
}

export async function pickPdf(): Promise<Picked<PreparedFile>> {
  return { error: 'Add the résumé from the web app (choosing files on phones comes later).' };
}
