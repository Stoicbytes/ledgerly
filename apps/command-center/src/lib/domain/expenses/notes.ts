import type { Transaction, TransactionKind } from './types';

/** A note used before, with the category it was most often filed under. */
export type NoteSuggestion = { note: string; categoryId: string | null; count: number };

type SuggestOptions = {
  /** What has been typed so far (may be empty). */
  query: string;
  kind: TransactionKind;
  /** The entry's chosen category, if any: its notes rank first. */
  categoryId: string | null;
  limit?: number;
};

type Group = {
  note: string;
  count: number;
  latest: string;
  byCategory: Map<string | null, number>;
};

/** 3 = starts with the query, 2 = a word starts with it, 1 = contains it, 0 = no match. */
function matchStrength(note: string, query: string): number {
  if (!query) return 1;
  if (note.startsWith(query)) return 3;
  if (note.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  return note.includes(query) ? 1 : 0;
}

/**
 * Note suggestions from earlier entries of the same kind, for the entry sheet's note
 * field. Ranked: notes from the chosen category, then how well they match what was
 * typed, then how often they were used, then how recently. Case-insensitive; each
 * note appears once, in the spelling used most recently.
 */
export function suggestNotes(
  transactions: Transaction[],
  { query, kind, categoryId, limit = 8 }: SuggestOptions,
): NoteSuggestion[] {
  const needle = query.trim().toLocaleLowerCase();
  const groups = new Map<string, Group>();
  for (const transaction of transactions) {
    if (transaction.kind !== kind) continue;
    const note = transaction.note.trim();
    if (!note) continue;
    const key = note.toLocaleLowerCase();
    const group = groups.get(key) ?? { note, count: 0, latest: '', byCategory: new Map() };
    group.count += 1;
    if (transaction.date >= group.latest) {
      group.latest = transaction.date;
      group.note = note;
    }
    group.byCategory.set(
      transaction.categoryId,
      (group.byCategory.get(transaction.categoryId) ?? 0) + 1,
    );
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const usual = [...group.byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        group,
        usual,
        strength: matchStrength(key, needle),
        sameCategory: !!categoryId && group.byCategory.has(categoryId),
        exact: key === needle,
      };
    })
    .filter((item) => item.strength > 0 && !item.exact)
    .sort(
      (a, b) =>
        Number(b.sameCategory) - Number(a.sameCategory) ||
        b.strength - a.strength ||
        b.group.count - a.group.count ||
        b.group.latest.localeCompare(a.group.latest),
    )
    .slice(0, limit)
    .map(({ group, usual }) => ({ note: group.note, categoryId: usual, count: group.count }));
}
