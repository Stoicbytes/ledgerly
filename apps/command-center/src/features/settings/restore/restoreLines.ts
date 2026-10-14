import { parseIsoDate } from '@/lib/domain/expenses';
import {
  KIND_LABELS,
  RESTORE_KINDS,
  siteItemCount,
  type Backup,
  type RestorePlan,
} from '@/lib/domain/backup';
import type { RestoreResult } from './runRestore';

const day = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    parseIsoDate(iso.slice(0, 10)),
  );
const n = (value: number) => value.toLocaleString('en-IN');
const count = (value: number, [one, many]: [string, string]) =>
  `${n(value)} ${value === 1 ? one : many}`;
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const NOT_IN_BACKUP =
  'Receipt photos and portfolio images are not in backups: restored entries come back without them.';

/** What a restore would do, kind by kind, before anything is added. */
export function reviewLines(backup: Backup, plan: RestorePlan, site: string): string[] {
  const lines = [`Backup made ${day(backup.exportedAt)}.`];
  if (plan.range) {
    lines.push(`Entries from ${day(plan.range.start)} to ${day(plan.range.end)}.`);
  }
  for (const kind of RESTORE_KINDS) {
    const c = plan.counts[kind];
    if (!c.inFile || plan.unavailable.includes(kind)) continue;
    const parts = [`${n(c.add)} to add`];
    if (c.same) parts.push(`${n(c.same)} already here`);
    if (c.matched) parts.push(`${n(c.matched)} matched by name`);
    if (c.changed) parts.push(`${n(c.changed)} differ here (yours kept)`);
    if (c.clashes) parts.push(`${n(c.clashes)} left out (already here under another id)`);
    lines.push(`${cap(KIND_LABELS[kind][1])}: ${n(c.inFile)} in the file, ${parts.join(', ')}.`);
  }
  for (const kind of plan.unavailable) {
    lines.push(
      `${cap(KIND_LABELS[kind][1])} cannot be restored until the database is updated (see SUPABASE_SETUP.md).`,
    );
  }
  const items = siteItemCount(backup.site);
  if (items) {
    lines.push(
      site === 'empty'
        ? `Portfolio site: ${count(items, ['item', 'items'])} to add (your portfolio is empty).`
        : site === 'notEmpty'
          ? 'Portfolio site: skipped, yours already has content.'
          : 'Portfolio site: restored only when signed in and your portfolio is empty.',
    );
  }
  if (!plan.total) lines.unshift('Everything in this backup is already here: nothing to add.');
  lines.push(NOT_IN_BACKUP);
  return lines;
}

/** What a finished restore did. */
export function doneLines(result: RestoreResult, saved: boolean): string[] {
  const { plan, site } = result;
  const lines = [
    result.stopped
      ? 'The restore stopped part way (connection or a refused record). What was saved is shown; restore the same file again to add the rest.'
      : `Restored ${count(plan.total, ['record', 'records'])}. Nothing here was changed or deleted.`,
  ];
  const changed = RESTORE_KINDS.reduce((sum, kind) => sum + plan.counts[kind].changed, 0);
  if (changed)
    lines.push(`${count(changed, ['record', 'records'])} differ from the backup; yours were kept.`);
  if (site.status === 'restored') {
    const extra = site.invalid + site.failed;
    lines.push(
      `Portfolio site: ${count(site.saved.length, ['item', 'items'])} added${extra ? `, ${n(extra)} could not be` : ''}. Publish it again when ready.`,
    );
  } else if (site.status === 'notEmpty') {
    lines.push('Portfolio site: skipped, yours already has content.');
  } else if (site.status === 'unreadable') {
    lines.push('Portfolio site: skipped, it could not be loaded.');
  }
  if (!saved) lines.push('Preview: nothing is saved.');
  return lines;
}
