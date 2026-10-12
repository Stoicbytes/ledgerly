import type { PlannedTrade } from './importPlan';

/** A trade already in the app, in the tradebook's terms (price in rupees). */
export type KnownTrade = { date: string; kind: string; quantity: number; price: number };

const sameDay = (a: { date: string; kind: string }, b: { date: string; kind: string }) =>
  a.date === b.date && a.kind === b.kind;

/**
 * Gives each trade to add an id, and a reason when it may be a trade already in the app
 * entered differently: `leftover` holds the app's trades no file trade matched exactly.
 *
 *   * same day, side and quantity at another price (a corrected or rounded price);
 *   * several fills that add up to one trade in the app (the broker splits an order);
 *   * otherwise any unmatched trade on the same day and side.
 *
 * Flagged trades start unticked in the review; the user decides.
 */
export function withIds(
  key: string,
  add: Omit<PlannedTrade, 'id' | 'duplicate'>[],
  leftover: KnownTrade[],
  priceText: (price: number) => string,
): PlannedTrade[] {
  return add.map((trade, index) => {
    const side = trade.kind === 'buy' ? 'buy' : 'sale';
    const same = leftover.filter((known) => sameDay(known, trade));
    const quantity = same.find((known) => Math.abs(known.quantity - trade.quantity) < 1e-6);
    const fills = add.filter((other) => sameDay(other, trade));
    const total = fills.reduce((sum, other) => sum + other.quantity, 0);
    let duplicate: string | null = null;
    if (quantity) {
      duplicate = `Possible duplicate: the app has this ${side} on this day at ${priceText(quantity.price)}.`;
    } else if (fills.length > 1 && same.some((known) => Math.abs(known.quantity - total) < 1e-6)) {
      duplicate = `Possible duplicate: with the other ${fills.length - 1} on this day, it adds up to one ${side} in the app.`;
    } else if (same.length) {
      duplicate = `Possible duplicate: the app already has a ${side} on this day.`;
    }
    return { ...trade, id: `${key}#${index}`, duplicate };
  });
}
