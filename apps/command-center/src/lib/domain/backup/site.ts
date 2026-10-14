import {
  emptySiteData,
  FIELDS,
  formValues,
  savePayload,
  SITE_KINDS,
  validateValues,
  type EditKind,
  type Row,
  type SiteData,
  type Values,
} from '@/lib/domain/site';
import { assert, isPlainObject, uuid } from './guard';

/**
 * The portfolio site's part of a backup. Its rows keep the database's column names, so
 * the file is only checked for shape and size here; each item is checked against the
 * editor's own rules when it is planned (sitePayloads). Messages and the published copy
 * are not restored.
 */
const MAX_ITEMS = 500;
const MAX_TEXT = 20_000;

const primitive = (value: unknown) =>
  value === null ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.length <= MAX_TEXT);

const flat = (value: unknown) =>
  isPlainObject(value) && Object.keys(value).length <= 20 && Object.values(value).every(primitive);

function cell(value: unknown, path: string) {
  if (primitive(value) || flat(value)) return;
  assert(Array.isArray(value) && value.length <= 100, path, 'is not a value the site keeps');
  for (const item of value as unknown[])
    assert(primitive(item) || flat(item), path, 'is not valid');
}

function row(value: unknown, path: string): Row {
  assert(isPlainObject(value) && Object.keys(value).length <= 60, path, 'is not an item');
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = { id: uuid(source.id, `${path}.id`) };
  for (const key of Object.keys(source)) {
    cell(source[key], `${path}.${key}`);
    if (key !== 'id') out[key] = source[key];
  }
  return out as Row;
}

export function siteCheck(value: unknown, path: string): SiteData | null {
  if (value === null || value === undefined) return null;
  assert(isPlainObject(value), path, 'is not an object');
  const source = value as Record<string, unknown>;
  const site = emptySiteData();
  site.profile = source.profile == null ? null : row(source.profile, `${path}.profile`);
  const rows = source.rows ?? {};
  assert(isPlainObject(rows), `${path}.rows`, 'is not an object');
  for (const key of Object.keys(rows as object)) {
    assert((SITE_KINDS as readonly string[]).includes(key), `${path}.rows.${key}`, 'is unknown');
  }
  for (const kind of SITE_KINDS) {
    const list = (rows as Record<string, unknown>)[kind] ?? [];
    const at = `${path}.rows.${kind}`;
    assert(Array.isArray(list) && list.length <= MAX_ITEMS, at, 'is not a list of items');
    site.rows[kind] = (list as unknown[]).map((item, index) => row(item, `${at}[${index}]`));
  }
  // Messages and the published copy are read only for their shape; they are not restored.
  assert(source.messages === undefined || Array.isArray(source.messages), path, 'has bad messages');
  return site;
}

const MEDIA = new Set(['image', 'file', 'gallery']);

export type SiteItem = { kind: EditKind; id: string; payload: Values };

/**
 * What would be saved through the portfolio's own repository, item by item, in an order
 * where skill groups come before their skills. Images and files are left out (they are
 * not in the backup); items that fail the editor's checks are counted, not saved.
 */
export function sitePayloads(site: SiteData): { items: SiteItem[]; invalid: number } {
  const items: SiteItem[] = [];
  let invalid = 0;
  const groups = new Set(site.rows.skill_group.map((item) => item.id));
  const add = (kind: EditKind, source: Row, siblings: Row[]) => {
    const values = formValues(kind, source);
    for (const field of FIELDS[kind]) {
      if (MEDIA.has(field.type)) values[field.key] = field.type === 'gallery' ? [] : null;
    }
    const id = kind === 'profile' ? undefined : source.id;
    const errors = validateValues(kind, values, siblings, id);
    const orphan = kind === 'skill' && !groups.has(String(values.group_id));
    if (Object.keys(errors).length || orphan) invalid += 1;
    else items.push({ kind, id: source.id, payload: savePayload(kind, values, id) });
  };
  if (site.profile) add('profile', site.profile, []);
  for (const kind of SITE_KINDS) {
    const rows = [...site.rows[kind]].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
    for (const item of rows) add(kind, item, rows);
  }
  return { items, invalid };
}

export const siteItemCount = (site: SiteData | null) =>
  site ? (site.profile ? 1 : 0) + SITE_KINDS.reduce((n, kind) => n + site.rows[kind].length, 0) : 0;
