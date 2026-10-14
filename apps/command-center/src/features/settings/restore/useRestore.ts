import { useCallback, useRef, useState } from 'react';
import { pickFiles } from '@/features/investments/import/pickFiles';
import type { Backup } from '@/lib/domain/backup';
import { MAX_BACKUP_BYTES } from '@/lib/domain/backup/types';
import type { RestoreResult } from './runRestore';

import { loadEngine as engine } from './loadEngine';

export type RestoreState =
  | { phase: 'choose'; problem: string | null; notice: string | null }
  | { phase: 'reading' }
  | { phase: 'review'; file: string; backup: Backup; lines: string[]; total: number }
  | { phase: 'restoring'; saved: number; total: number }
  | { phase: 'done'; result: RestoreResult; lines: string[] };

const CHOOSE: RestoreState = { phase: 'choose', problem: null, notice: null };
const choose = (problem: string | null, notice: string | null = null): RestoreState => ({
  phase: 'choose',
  problem,
  notice,
});

/**
 * Choose a backup → review → restore → (undo). The file is read and checked on this
 * device; nothing is added until `approve`, which plans again against the data as it
 * is then, so restoring the same file twice adds nothing.
 */
export function useRestore(cloud: boolean) {
  const [state, setState] = useState<RestoreState>(CHOOSE);
  const busy = useRef(false);

  const pick = useCallback(async () => {
    const picked = await pickFiles({
      accept: '.json,application/json',
      maxBytes: MAX_BACKUP_BYTES,
      multiple: false,
    });
    if (!picked) return;
    if (!picked.length) return setState(choose('The file is larger than 20 MB.'));
    const file = picked[0];
    setState({ phase: 'reading' });
    let module: Awaited<ReturnType<typeof engine>>;
    try {
      module = await engine();
    } catch {
      return setState(choose('Restore could not be loaded. Check your connection.'));
    }
    try {
      const backup = module.parseBackup(file.bytes);
      const [current, site] = await Promise.all([
        module.currentData(cloud),
        module.siteState(cloud),
      ]);
      const plan = module.planRestore(backup, current);
      const lines = module.reviewLines(backup, plan, site);
      setState({ phase: 'review', file: file.name, backup, lines, total: plan.total });
    } catch (error) {
      const reason =
        error instanceof module.BackupError
          ? error.message
          : 'Your data could not be loaded. Try again.';
      setState(choose(`${file.name}: ${reason}`));
    }
  }, [cloud]);

  const approve = useCallback(async () => {
    if (state.phase !== 'review' || busy.current) return;
    busy.current = true;
    setState({ phase: 'restoring', saved: 0, total: 0 });
    try {
      const module = await engine();
      const result = await module.runRestore(state.backup, cloud, (saved, total) =>
        setState({ phase: 'restoring', saved, total }),
      );
      setState({ phase: 'done', result, lines: module.doneLines(result, cloud) });
    } catch (error) {
      const reason = error instanceof Error && error.message.startsWith('Some changes');
      setState(
        choose(reason ? (error as Error).message : 'The restore did not start. Nothing was added.'),
      );
    } finally {
      busy.current = false;
    }
  }, [state, cloud]);

  const undo = useCallback(async () => {
    if (state.phase !== 'done' || busy.current) return;
    busy.current = true;
    try {
      const removed = await (await engine()).undoRestore(state.result);
      const what = `${removed.toLocaleString('en-IN')} ${removed === 1 ? 'record' : 'records'}`;
      setState(choose(null, `Restore undone: ${what} removed.`));
    } finally {
      busy.current = false;
    }
  }, [state]);

  const reset = useCallback(() => setState(CHOOSE), []);

  return { state, pick, approve, undo, reset };
}
