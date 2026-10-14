/**
 * Small strict checks for reading a backup file. Every check returns a clean copy built
 * only from the keys it knows (so nothing from the file is trusted as is), or throws a
 * BackupError naming where the file is wrong.
 */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export type Check<T> = (value: unknown, path: string) => T;

const fail = (path: string, what: string): never => {
  throw new BackupError(`${path} ${what}.`);
};

/** Keys that could reach an object's prototype; never accepted anywhere in a file. */
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const uuid: Check<string> = (value, path) =>
  typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : fail(path, 'is not an id');

/** Text up to `max` characters; `min` counts characters after trimming. */
export const text =
  (max: number, min = 0, pattern?: RegExp): Check<string> =>
  (value, path) => {
    if (typeof value !== 'string') return fail(path, 'is not text');
    if (value.length > max) return fail(path, `is longer than ${max} characters`);
    if (value.trim().length < min) return fail(path, 'is empty');
    if (pattern && !pattern.test(value)) return fail(path, 'is not in the expected format');
    return value;
  };

/** A whole number (paise, counts, orders) between `min` and `max`. */
export const int =
  (min: number, max: number): Check<number> =>
  (value, path) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
      ? value
      : fail(path, `is not a whole number from ${min} to ${max}`);

// Allows for binary floating point (12.3456 * 10000 is not exactly 123456).
const isRounded = (scaled: number) =>
  Math.abs(Math.round(scaled) - scaled) <= 1e-6 * Math.max(1, Math.abs(scaled));

/** A number with at most `decimals` places (NAVs, units, percentages). */
export const decimal =
  (min: number, max: number, decimals: number, exclusiveMin = false): Check<number> =>
  (value, path) => {
    const ok =
      typeof value === 'number' &&
      Number.isFinite(value) &&
      (exclusiveMin ? value > min : value >= min) &&
      value <= max &&
      isRounded(value * 10 ** decimals);
    return ok ? value : fail(path, `is not a number from ${min} to ${max}`);
  };

export const bool: Check<boolean> = (value, path) =>
  typeof value === 'boolean' ? value : fail(path, 'is not true or false');

/** A real calendar date, YYYY-MM-DD, within the database's range. */
export const date =
  (from: string, to: string): Check<string> =>
  (value, path) => {
    if (typeof value !== 'string' || !DATE.test(value)) return fail(path, 'is not a date');
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      return fail(path, 'is not a real date');
    }
    return value >= from && value <= to ? value : fail(path, `is outside ${from} to ${to}`);
  };

/** A time in milliseconds since 1970 (created, deleted), up to the year 2100. */
export const millis: Check<number> = int(0, 4_102_444_800_000);

export const oneOf =
  <T extends string>(choices: readonly T[]): Check<T> =>
  (value, path) =>
    choices.includes(value as T) ? (value as T) : fail(path, 'is not one of the known values');

export const nullable =
  <T>(check: Check<T>): Check<T | null> =>
  (value, path) =>
    value === null ? null : check(value, path);

/** Absent in older files: the default is used. */
export const optional =
  <T>(check: Check<T>, fallback: T): Check<T> =>
  (value, path) =>
    value === undefined ? fallback : check(value, path);

export const list =
  <T>(check: Check<T>, max: number): Check<T[]> =>
  (value, path) => {
    if (!Array.isArray(value)) return fail(path, 'is not a list');
    if (value.length > max) return fail(path, `has more than ${max} items`);
    return value.map((item, index) => check(item, `${path}[${index}]`));
  };

type Shape = Record<string, Check<unknown>>;
type Shaped<S extends Shape> = { [K in keyof S]: ReturnType<S[K]> };

/** An object with exactly these keys (absent ones go to their check); others are refused. */
export const record =
  <S extends Shape>(shape: S): Check<Shaped<S>> =>
  (value, path) => {
    if (!isPlainObject(value)) return fail(path, 'is not an object');
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(shape, key)) fail(`${path}.${key}`, 'is unknown');
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) out[key] = shape[key](value[key], `${path}.${key}`);
    return out as Shaped<S>;
  };

export const assert = (ok: boolean, path: string, what: string) => {
  if (!ok) fail(path, what);
};
