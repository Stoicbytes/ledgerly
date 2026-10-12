/** Dates and periods as the site shows them (calendar dates from the database). */
const MONTH = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

export const monthYear = (iso: string | null) => (iso ? MONTH.format(toDate(iso)) : '');
export const fullDate = (iso: string | null) => (iso ? DAY.format(toDate(iso)) : '');
export const year = (iso: string | null) => (iso ? iso.slice(0, 4) : '');

/** "May 2024 — Aug 2025" or "Aug 2025 — Present". */
export function period(start: string | null, end: string | null, ongoing = 'Present'): string {
  if (!start) return end ? monthYear(end) : '';
  return `${monthYear(start)} — ${end ? monthYear(end) : ongoing}`;
}

/** Whole months between two dates, counted the way CVs do (both months included). */
export function monthsBetween(start: string, end: string | null, today: string): number {
  const a = toDate(start);
  const b = toDate(end ?? today);
  const months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;
  return Math.max(1, months);
}

/** "1 yr 3 mos" */
export function duration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years ? `${years} ${years === 1 ? 'yr' : 'yrs'}` : '',
    rest ? `${rest} ${rest === 1 ? 'mo' : 'mos'}` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

/** "14:05" in the given IANA time zone, with its short name ("IST"); empty if unknown. */
export function clock(timezone: string, now: Date): { time: string; zone: string } | null {
  if (!timezone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    const zone = get('timeZoneName');
    return {
      time: `${get('hour')}:${get('minute')}`,
      zone: timezone === 'Asia/Kolkata' && /GMT\+5:30/.test(zone) ? 'IST' : zone,
    };
  } catch {
    return null;
  }
}

/** 2.5 → "2.5", 5 → "5", 12000 → "12,000". */
export function figure(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  in_progress: 'In progress',
  completed: 'Completed',
  archived: 'Archived',
  concept: 'Concept',
};
