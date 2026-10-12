import {
  emptySiteData,
  SITE_KINDS,
  type EditKind,
  type Publication,
  type Row,
  type SiteData,
  type SiteKind,
  type SiteMessage,
  type Values,
} from '@/lib/domain/site';
import { callRpc } from './rpc';

/**
 * The portfolio's working copy, publishing and messages (migration 0010). Every call
 * runs as the signed-in user, so Row Level Security and two-step sign-in apply; the
 * public site never uses these functions.
 */
type Raw = Record<string, unknown>;

const LIST_KEYS: Record<SiteKind, string> = {
  link: 'links',
  fact: 'facts',
  skill_group: 'skill_groups',
  skill: 'skills',
  project: 'projects',
  experience: 'experience',
  education: 'education',
  section: 'sections',
};

const isObject = (value: unknown): value is Raw =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isRow = (value: unknown): value is Row => isObject(value) && typeof value.id === 'string';
const str = (value: unknown) => (typeof value === 'string' ? value : '');

function publicationFromRemote(raw: unknown): Publication | null {
  if (!isObject(raw) || typeof raw.handle !== 'string') return null;
  return {
    handle: raw.handle,
    version: typeof raw.version === 'number' ? raw.version : 1,
    publishedAt: str(raw.published_at),
    dirty: raw.dirty === true,
  };
}

export function siteFromRemote(raw: unknown): SiteData {
  const data = emptySiteData();
  if (!isObject(raw)) return data;
  data.profile = isRow(raw.profile) ? raw.profile : null;
  for (const kind of SITE_KINDS) {
    const list = raw[LIST_KEYS[kind]];
    data.rows[kind] = Array.isArray(list) ? list.filter(isRow) : [];
  }
  data.messages = (Array.isArray(raw.messages) ? raw.messages : [])
    .filter(isRow)
    .map((row): SiteMessage => ({
      id: row.id,
      name: str(row.name),
      email: str(row.email),
      message: str(row.message),
      createdAt: str(row.created_at),
      readAt: typeof row.read_at === 'string' ? row.read_at : null,
    }));
  data.publication = publicationFromRemote(raw.publication);
  return data;
}

export const loadSite = async () => siteFromRemote(await callRpc<unknown>('portfolio_load'));

export const saveSiteItem = async (kind: EditKind, row: Values): Promise<Row> => {
  const saved = await callRpc<unknown>('portfolio_save', { p_kind: kind, p_row: row });
  if (!isRow(saved)) throw new Error('Unexpected reply');
  return saved;
};

export const deleteSiteItem = (kind: SiteKind | 'message', id: string) =>
  callRpc<null>('portfolio_delete', { p_kind: kind, p_id: id });

export const reorderSiteItems = (kind: SiteKind, ids: string[]) =>
  callRpc<null>('portfolio_reorder', { p_kind: kind, p_ids: ids });

export const markSiteMessage = (id: string, read: boolean) =>
  callRpc<null>('portfolio_mark_message', { p_id: id, p_read: read });

export const publishSite = async () =>
  publicationFromRemote(await callRpc<unknown>('portfolio_publish'));

export const unpublishSite = () => callRpc<null>('portfolio_unpublish');

/** A one-time preview link token (valid for 20 minutes). */
export const createPreviewToken = () => callRpc<string>('portfolio_preview_token');

/** Files the working copy or the live site still uses. */
export const usedMediaPaths = async () =>
  (await callRpc<string[] | null>('portfolio_media_paths')) ?? [];
