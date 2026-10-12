import { useEffect, useState } from 'react';
import { useSession } from '@/features/auth/sessionStore';
import {
  listReceipts,
  mediaFolder,
  removeReceipts,
  signedReceiptUrl,
  uploadReceiptFile,
} from '@/lib/data/storageRepository';
import { photoExtension, type Photo, type Transaction } from '@/lib/domain/expenses';
import { newId } from '@/lib/ids';
import { receiptFile } from './receiptFile';

/**
 * Receipt photos for a signed-in user live in the private `receipts` bucket, under their
 * own folder, with a new random name per upload (files are never overwritten). In the
 * preview nothing is uploaded and the photo stays in memory.
 */
export async function storeReceipt(photo: Photo): Promise<Photo> {
  if (useSession.getState().status !== 'signedIn') return photo;
  const file = await receiptFile(photo);
  const path = `${await mediaFolder()}/${newId()}.${photoExtension(file.mimeType)}`;
  await uploadReceiptFile(path, file.blob, file.mimeType);
  return {
    ...photo,
    path,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
    bytes: file.blob.size,
  };
}

/**
 * What an <Image> can show: the picked file on this device, else a link to the stored
 * copy that expires after a minute (fetched when shown, never kept).
 */
export function useReceiptUri(photo: Photo | null | undefined): {
  uri: string | null;
  failed: boolean;
} {
  const local = photo?.uri || null;
  const path = local ? null : (photo?.path ?? null);
  const [signed, setSigned] = useState<{ path: string; uri: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let live = true;
    signedReceiptUrl(path).then(
      (uri) => live && setSigned({ path, uri }),
      () => live && setSigned({ path, uri: null }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  if (local) return { uri: local, failed: false };
  if (!path || signed?.path !== path) return { uri: null, failed: false };
  return { uri: signed.uri, failed: !signed.uri };
}

/**
 * A replaced or removed photo, or one picked for an entry that was never saved, stays in
 * the bucket until this removes it. Only files a day old or more go: another device may
 * have just uploaded a photo for an entry it has not saved yet.
 */
const GRACE_MS = 24 * 60 * 60 * 1000;

export async function cleanUnusedReceipts(
  transactions: readonly Transaction[],
  now = Date.now(),
): Promise<number> {
  const used = new Set(transactions.flatMap((t) => (t.photo?.path ? [t.photo.path] : [])));
  const files = await listReceipts(await mediaFolder());
  const unused = files
    .filter((file) => !used.has(file.path))
    .filter((file) => now - Date.parse(file.createdAt) >= GRACE_MS)
    .map((file) => file.path);
  await removeReceipts(unused);
  return unused.length;
}
