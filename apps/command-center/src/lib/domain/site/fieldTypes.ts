import type { Values } from './types';

/** The shape of one form field (the lists of fields are in *Fields.ts). */
type Base = {
  key: string;
  label: string;
  hint?: string;
  required?: boolean;
  /** Show the field only when this returns true (e.g. a number only for counters). */
  when?: (values: Values) => boolean;
};

export type FieldSpec =
  | (Base & {
      type: 'text';
      max: number;
      format?: 'slug' | 'handle' | 'email' | 'url' | 'httpsUrl' | 'timezone';
      placeholder?: string;
    })
  | (Base & { type: 'markdown'; max: number; rows?: number })
  | (Base & { type: 'list'; maxItems: number; maxLength: number })
  | (Base & { type: 'tags'; maxItems: number; maxLength: number })
  | (Base & { type: 'choice'; options: readonly { value: string; label: string }[] })
  | (Base & { type: 'switch' })
  | (Base & { type: 'date' })
  | (Base & { type: 'number'; min: number; max: number })
  | (Base & { type: 'level' | 'icon' | 'group' | 'sections' | 'items' | 'gallery' | 'file' })
  | (Base & { type: 'image'; wide?: boolean });

export const options = (...pairs: [string, string][]) =>
  pairs.map(([value, label]) => ({ value, label }));
export const visible: FieldSpec = {
  key: 'visible',
  type: 'switch',
  label: 'Show on the portfolio',
  hint: 'Off keeps it as a draft: you see it in Preview, visitors never do.',
};
