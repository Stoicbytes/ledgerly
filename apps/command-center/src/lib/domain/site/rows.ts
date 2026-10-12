import { FIELDS } from './fields';
import type { EditKind, FieldValue, Row, SiteKind, Values } from './types';

/** Starting values for a new item (the database's own defaults). */
const DEFAULTS: Record<EditKind, Values> = {
  profile: { availability: 'hidden', rotating_words: [], hidden_sections: [] },
  link: { kind: 'website', visible: true },
  fact: { kind: 'stat', visible: true },
  skill_group: { visible: true },
  skill: { level: null, featured: false, visible: true },
  project: {
    status: 'completed',
    accent: 'ember',
    tech: [],
    features: [],
    gallery: [],
    featured: false,
    visible: true,
  },
  experience: { responsibilities: [], highlights: [], achievements: [], tech: [], visible: true },
  education: { kind: 'certification', visible: true },
  section: { kind: 'custom', items: [], visible: true },
};

function blank(type: string): FieldValue {
  if (
    type === 'list' ||
    type === 'tags' ||
    type === 'sections' ||
    type === 'items' ||
    type === 'gallery'
  )
    return [];
  if (type === 'switch') return false;
  if (
    type === 'image' ||
    type === 'file' ||
    type === 'date' ||
    type === 'number' ||
    type === 'level'
  )
    return null;
  return '';
}

/** Values for the editor: every field present, taken from the row or a default. */
export function formValues(kind: EditKind, row: Row | null): Values {
  const values: Values = {};
  for (const field of FIELDS[kind]) {
    const value = row?.[field.key] ?? DEFAULTS[kind][field.key];
    values[field.key] = value === undefined ? blank(field.type) : value;
  }
  return values;
}

/**
 * What is sent to portfolio_save: only this kind's fields, trimmed, with empty optional
 * links and dates as null and hidden fields cleared (e.g. a number on a highlight).
 */
export function savePayload(kind: EditKind, values: Values, id?: string | null): Values {
  const payload: Values = id ? { id } : {};
  for (const field of FIELDS[kind]) {
    let value = values[field.key];
    if (field.when && !field.when(values)) value = blank(field.type);
    if (typeof value === 'string') value = value.trim();
    if (Array.isArray(value) && (field.type === 'list' || field.type === 'tags')) {
      value = (value as string[]).map((item) => item.trim()).filter(Boolean);
    }
    const nullable =
      field.type === 'date' ||
      (field.type === 'text' &&
        (field.format === 'url' || field.format === 'httpsUrl' || field.key === 'handle'));
    if (value === undefined || value === null || value === '') {
      value = nullable ? null : blank(field.type);
    }
    payload[field.key] = value;
  }
  return payload;
}

/** "My First Project!" → "my-first-project" */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

const str = (value: FieldValue | undefined) => (typeof value === 'string' ? value : '');
const list = (value: FieldValue | undefined) =>
  Array.isArray(value)
    ? (value as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];

/** A list row's text: what it is, and a short second line. */
export function rowSummary(kind: SiteKind, row: Row): { title: string; detail: string } {
  switch (kind) {
    case 'link':
      return { title: str(row.label), detail: str(row.url) };
    case 'fact':
      return row.kind === 'stat'
        ? { title: `${row.value ?? ''}${str(row.suffix)} ${str(row.label)}`, detail: 'Number' }
        : {
            title: str(row.label),
            detail: row.kind === 'milestone' ? `Milestone · ${str(row.when_label)}` : 'Highlight',
          };
    case 'skill_group':
      return { title: str(row.name), detail: str(row.description) };
    case 'skill':
      return { title: str(row.name), detail: str(row.description) };
    case 'project':
      return {
        title: str(row.title),
        detail: [str(row.period), str(row.category), list(row.tech).slice(0, 3).join(', ')]
          .filter(Boolean)
          .join(' · '),
      };
    case 'experience':
      return {
        title: `${str(row.role)} · ${str(row.company)}`,
        detail: [str(row.client), `${str(row.started_on)} – ${str(row.ended_on) || 'now'}`]
          .filter(Boolean)
          .join(' · '),
      };
    case 'education':
      return {
        title: str(row.title),
        detail: [str(row.issuer), str(row.issued_on) || str(row.ended_on)]
          .filter(Boolean)
          .join(' · '),
      };
    case 'section':
      return {
        title: str(row.title),
        detail: `${Array.isArray(row.items) ? row.items.length : 0} items`,
      };
  }
}

/** Items in display order (as the site shows them). */
export const ordered = (rows: Row[]) =>
  [...rows].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

/** Ids after moving one item up (-1) or down (+1); null when it cannot move. */
export function moved(rows: Row[], id: string, delta: -1 | 1): string[] | null {
  const ids = ordered(rows).map((row) => row.id);
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  return ids;
}
