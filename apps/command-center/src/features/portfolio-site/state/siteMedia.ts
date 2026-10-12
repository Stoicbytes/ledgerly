import { usedMediaPaths } from '@/lib/data/siteRepository';
import { listMedia, mediaFolder, removeMedia, uploadMedia } from '@/lib/data/storageRepository';
import type { PreparedFile, PreparedImage } from '@/lib/device/media';
import type { FileRef, Media } from '@/lib/domain/site';
import { newId } from '@/lib/ids';

/**
 * Uploads chosen images and PDFs into the user's folder of the portfolio bucket. Each
 * upload gets a new random name (files are never overwritten), so a replaced image
 * stays until nothing uses it; cleanUnusedMedia() then removes it.
 */
export async function uploadImage(image: PreparedImage, alt: string): Promise<Media> {
  const folder = await mediaFolder();
  const id = newId();
  const path = `${folder}/${id}.${image.ext}`;
  await uploadMedia(path, image.full, image.type);
  let small: string | null = null;
  if (image.small) {
    small = `${folder}/${id}-sm.${image.ext}`;
    await uploadMedia(small, image.small, image.type);
  }
  return { path, small, width: image.width, height: image.height, alt };
}

export async function uploadPdf(file: PreparedFile): Promise<FileRef> {
  const folder = await mediaFolder();
  const path = `${folder}/${newId()}.pdf`;
  await uploadMedia(path, file.blob, 'application/pdf');
  return { path, name: file.name, size: file.size };
}

/**
 * Uploads nothing uses (drafts and the live site included) that are over an hour old: an
 * open form may still be about to use a newer one. A file of unknown age is kept.
 */
const GRACE_MS = 60 * 60 * 1000;

export async function cleanUnusedMedia(now = Date.now()): Promise<number> {
  const [used, files] = await Promise.all([usedMediaPaths(), mediaFolder().then(listMedia)]);
  const keep = new Set(used);
  const unused = files
    .filter((file) => !keep.has(file.path))
    .filter((file) => now - Date.parse(file.createdAt) > GRACE_MS)
    .map((file) => file.path);
  await removeMedia(unused);
  return unused.length;
}
