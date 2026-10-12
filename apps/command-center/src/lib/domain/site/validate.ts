import { shownFields, type FieldSpec } from './fields';
import type { EditKind, GalleryItem, Row, SectionItem, Values } from './types';

/**
 * Checks before saving, the same rules the database applies (it checks again: these
 * only give a clear message next to the right field).
 */
export type Errors = Record<string, string>;

const FORMATS: Record<string, [RegExp, string]> = {
  slug: [
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Lowercase letters, numbers and single dashes, like my-project.',
  ],
  handle: [/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, '3 to 40 lowercase letters, numbers or dashes.'],
  email: [/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/, 'Enter an email address like name@example.com.'],
  timezone: [/^[A-Za-z]+(\/[A-Za-z0-9_+-]+){1,2}$/, 'Use a time zone name like Asia/Kolkata.'],
};

/** https://… (or mailto: when allowed), as the database's valid_link(). */
function isSafeUrl(value: string, allowMail = true): boolean {
  if (allowMail && /^mailto:[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(value)) return true;
  return /^https:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[^\s<>"]*)?$/.test(value) && value.length <= 500;
}

function checkField(field: FieldSpec, value: unknown): string | null {
  const empty = value === null || value === '' || (Array.isArray(value) && !value.length);
  if (empty) return field.required ? `${field.label} is needed.` : null;
  switch (field.type) {
    case 'text': {
      const text = String(value).trim();
      if (field.required && !text) return `${field.label} is needed.`;
      if (text.length > field.max) return `Keep it under ${field.max} characters.`;
      if (field.format === 'url' && !isSafeUrl(text)) return 'Use an https:// address.';
      if (field.format === 'httpsUrl' && !isSafeUrl(text, false)) return 'Use an https:// address.';
      const format = field.format ? FORMATS[field.format] : undefined;
      if (format && text && !format[0].test(text)) return format[1];
      return null;
    }
    case 'markdown':
      return String(value).length > field.max ? `Keep it under ${field.max} characters.` : null;
    case 'list':
    case 'tags': {
      const items = (value as string[]).map((item) => item.trim()).filter(Boolean);
      if (items.length > field.maxItems) return `Up to ${field.maxItems} items.`;
      const long = items.find((item) => item.length > field.maxLength);
      return long ? `Keep each item under ${field.maxLength} characters.` : null;
    }
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) && n >= field.min && n <= field.max ? null : 'Enter a number.';
    }
    case 'items': {
      const items = value as SectionItem[];
      if (items.length > 12) return 'Up to 12 items.';
      if (items.some((item) => !item.title.trim() || item.title.length > 80))
        return 'Each item needs a title (up to 80 characters).';
      if (items.some((item) => item.url && !isSafeUrl(item.url)))
        return 'Item links must be https:// addresses.';
      return null;
    }
    case 'gallery': {
      const items = value as GalleryItem[];
      if (items.length > 12) return 'Up to 12 images.';
      return items.some((item) => !item.alt.trim())
        ? 'Describe each image (for screen readers).'
        : null;
    }
    case 'image':
      return (value as { alt?: string }).alt?.trim()
        ? null
        : 'Describe the image (for screen readers).';
    default:
      return null;
  }
}

export function validateValues(
  kind: EditKind,
  values: Values,
  siblings: Row[] = [],
  id?: string | null,
): Errors {
  const errors: Errors = {};
  for (const field of shownFields(kind, values)) {
    const problem = checkField(field, values[field.key]);
    if (problem) errors[field.key] = problem;
  }
  const end = values.ended_on;
  const start = values.started_on;
  if (typeof end === 'string' && typeof start === 'string' && end && start && end < start) {
    errors.ended_on = 'The end is before the start.';
  }
  if (
    kind === 'education' &&
    values.expires_on &&
    values.issued_on &&
    String(values.expires_on) < String(values.issued_on)
  ) {
    errors.expires_on = 'It expires before it was issued.';
  }
  if (kind === 'project' && typeof values.slug === 'string') {
    if (siblings.some((row) => row.id !== id && row.slug === values.slug)) {
      errors.slug = 'Another project already uses this address.';
    }
  }
  return errors;
}
