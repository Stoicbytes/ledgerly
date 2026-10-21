/** One line on the home screen: what stands out, worked out from your own entries. */
export type Insight = {
  id: string;
  tone: 'warn' | 'good' | 'info';
  title: string;
  detail: string;
};

/** Whole percent, for insight text: "12%". */
export const pct = (value: number) => `${Math.round(value)}%`;

/** "September" for "2026-09". */
export const monthName = (month: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(
    new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1),
  );

/** Whole days from one ISO date to a later one (local calendar days). */
export function daysBetween(from: string, to: string): number {
  const day = (iso: string) =>
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((day(to) - day(from)) / 86_400_000);
}
