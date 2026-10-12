import type { FileRef, Media } from './types';

/** Small, strict readers for untrusted JSON (the published document). */
export type Raw = Record<string, unknown>;

export const obj = (v: unknown): Raw =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {};
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const str = (v: unknown, max = 20000): string =>
  typeof v === 'string' ? v.slice(0, max) : '';
export const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
export const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
export const bool = (v: unknown): boolean => v === true;
export const list = (v: unknown, max = 40): string[] =>
  arr(v)
    .map((item) => str(item, 400).trim())
    .filter(Boolean)
    .slice(0, max);
export const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
export const date = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;

/** https or mailto only, as the database enforces; anything else is dropped. */
export function safeUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 500) return null;
  if (/^mailto:[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v)) return v;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const MEDIA_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}(-sm)?\.(webp|jpe?g|png|avif)$/;
const FILE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/;

export function media(v: unknown): Media | null {
  const m = obj(v);
  const path = str(m.path);
  const width = num(m.width);
  const height = num(m.height);
  if (!MEDIA_PATH.test(path) || !width || !height) return null;
  const small = str(m.small);
  return {
    path,
    small: MEDIA_PATH.test(small) ? small : null,
    width,
    height,
    alt: str(m.alt, 200),
  };
}

export function file(v: unknown): FileRef | null {
  const f = obj(v);
  const path = str(f.path);
  return FILE_PATH.test(path)
    ? { path, name: str(f.name, 120) || 'Résumé.pdf', size: num(f.size) ?? 0 }
    : null;
}
