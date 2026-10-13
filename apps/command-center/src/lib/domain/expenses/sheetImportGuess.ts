import type { AccountGroup } from './types';

/** A new account's type from its name; anything unclear is a bank account. */
export function guessAccountGroup(name: string): AccountGroup {
  const lower = name.toLowerCase();
  if (/cash/.test(lower)) return 'cash';
  if (/card|credit/.test(lower)) return 'card';
  if (/wallet|paytm|phonepe|gpay|amazon pay/.test(lower)) return 'wallet';
  return 'bank';
}

const ICON_WORDS: [RegExp, string][] = [
  [/food|tea|snack|restaurant|grocer/, 'food'],
  [/transport|travel|cab|bus|train|petrol|fuel/, 'transport'],
  [/rent|house|home/, 'home'],
  [/social|friend|party/, 'social'],
  [/sport|gym|fitness/, 'sports'],
  [/hometown/, 'hometown'],
  [/mobile|phone|recharge/, 'mobile'],
  [/household/, 'household'],
  [/groom|salon|beauty/, 'grooming'],
  [/family|dad|mom|parent/, 'family'],
  [/gadget|electronic/, 'gadgets'],
  [/gift/, 'gift'],
  [/shop/, 'shops'],
  [/medic|pharma|doctor|health/, 'medicine'],
  [/station/, 'stationery'],
  [/salary|bonus/, 'salary'],
  [/bill|card/, 'bills'],
  [/saving|interest/, 'interest'],
];

export const guessCategoryIcon = (name: string) =>
  ICON_WORDS.find(([pattern]) => pattern.test(name.toLowerCase()))?.[1] ?? 'other';
