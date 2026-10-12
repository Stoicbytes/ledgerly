import { currentSession, RpcError } from './rpc';
import { supabaseConfig } from './supabaseConfig';

/**
 * Uploads for the portfolio (images and the résumé) in the public `portfolio-media`
 * bucket. Storage policies allow writes only in the signed-in user's own folder, with
 * two-step sign-in, and never overwrite a file: each upload gets a new random name.
 */
const MEDIA_BUCKET = 'portfolio-media';

export const mediaUrl = (path: string) =>
  supabaseConfig ? `${supabaseConfig.url}/storage/v1/object/public/${MEDIA_BUCKET}/${path}` : '';

async function storage(path: string, init: RequestInit): Promise<Response> {
  const { token } = await currentSession();
  if (!supabaseConfig) throw new RpcError(0, 'not_configured');
  let response: Response;
  try {
    response = await fetch(`${supabaseConfig.url}/storage/v1/${path}`, {
      ...init,
      headers: { apikey: supabaseConfig.key, Authorization: `Bearer ${token}`, ...init.headers },
    });
  } catch {
    throw new RpcError(0, 'network');
  }
  if (!response.ok) throw new RpcError(response.status, 'storage');
  return response;
}

/** The folder uploads must go in (the user's id), in either bucket. */
export const mediaFolder = async () => (await currentSession()).userId;

export const uploadMedia = (path: string, body: Blob, contentType: string) =>
  upload(MEDIA_BUCKET, path, body, contentType, 'max-age=31536000');

/** Files in the user's folder: name and upload time. */
export const listMedia = (folder: string) => list(MEDIA_BUCKET, folder);

export const removeMedia = (paths: string[]) => remove(MEDIA_BUCKET, paths);

/**
 * Receipt photos in the private `receipts` bucket (migration 0011): only the owner can
 * read, add or delete them, and they are shown through links that expire after a minute.
 */
const RECEIPT_BUCKET = 'receipts';

export const uploadReceiptFile = (path: string, body: Blob, contentType: string) =>
  upload(RECEIPT_BUCKET, path, body, contentType, 'private, max-age=3600');

export const listReceipts = (folder: string) => list(RECEIPT_BUCKET, folder);

export const removeReceipts = (paths: string[]) => remove(RECEIPT_BUCKET, paths);

/** A link to one receipt that stops working after `seconds`. */
export async function signedReceiptUrl(path: string, seconds = 60): Promise<string> {
  const response = await storage(`object/sign/${RECEIPT_BUCKET}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: seconds }),
  });
  const { signedURL } = (await response.json()) as { signedURL?: string };
  if (!signedURL || !supabaseConfig) throw new RpcError(0, 'storage');
  return `${supabaseConfig.url}/storage/v1${signedURL}`;
}

async function upload(
  bucket: string,
  path: string,
  body: Blob,
  contentType: string,
  cacheControl: string,
): Promise<void> {
  await storage(`object/${bucket}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'x-upsert': 'false', 'cache-control': cacheControl },
    body,
  });
}

async function list(
  bucket: string,
  folder: string,
): Promise<{ path: string; createdAt: string }[]> {
  const response = await storage(`object/list/${bucket}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: `${folder}/`, limit: 1000, offset: 0 }),
  });
  const rows = (await response.json()) as { name?: string; created_at?: string }[];
  return rows
    .filter((row) => row.name)
    .map((row) => ({ path: `${folder}/${row.name}`, createdAt: row.created_at ?? '' }));
}

async function remove(bucket: string, paths: string[]): Promise<void> {
  if (!paths.length) return;
  await storage(`object/${bucket}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  });
}
