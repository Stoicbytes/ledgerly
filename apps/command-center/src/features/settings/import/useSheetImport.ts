import { useCallback, useRef, useState } from 'react';
import { getLedger, useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { pickFiles } from '@/features/investments/import/pickFiles';
import { flushCloudSync } from '@/features/sync/cloudSync';
import { isCloudActive, useSyncStatus } from '@/features/sync/syncStatus';
import { withoutImported } from '@/lib/domain/expenses';
import {
  planSheetImport,
  readExpenseSheet,
  type SheetImportPlan,
  type SheetRead,
} from '@/lib/domain/expenses/sheetImports';
import { newId } from '@/lib/ids';

export type SheetImportState =
  | { phase: 'choose'; problem: string | null }
  | { phase: 'reading' }
  | { phase: 'review'; file: string; read: SheetRead; plan: SheetImportPlan }
  | { phase: 'done'; imported: SheetImportPlan; save: ImportSave };

/**
 * Signed in, an import is done only once the database confirms it: `saving` until then,
 * `saved`, or `notSaved` with how many entries did not make it (refused, or still waiting
 * to be sent). `preview`: nothing is saved.
 */
export type ImportSave =
  { state: 'preview' | 'saving' | 'saved' } | { state: 'notSaved'; refused: number };

export const TOO_LARGE = 'The file is larger than 5 MB. Export a shorter period and import each.';

export async function readSheet(name: string, bytes: Uint8Array): Promise<SheetRead> {
  if (/\.xls$/i.test(name)) {
    const problem = 'This is an old .xls file. Open it and save it as .xlsx or .csv first.';
    return { rows: [], skipped: [], problems: [problem] };
  }
  const { readSpreadsheet } = await import('@/lib/files/spreadsheet');
  const read = await readSpreadsheet(name, bytes);
  if ('problem' in read) return { rows: [], skipped: [], problems: [read.problem] };
  return readExpenseSheet(read.rows);
}

/**
 * Choose an export from another expense app → review → import. The file is read on this
 * device and not kept; nothing is added (or synced) until `approve`, which plans again
 * against the ledger as it is then (so edits made meanwhile, or a second press, add no
 * duplicates). `undo` removes exactly what was imported, keeping later changes.
 */
export function useSheetImport() {
  const [state, setState] = useState<SheetImportState>({ phase: 'choose', problem: null });
  const busy = useRef(false);

  const choose = useCallback(async () => {
    const picked = await pickFiles();
    if (!picked) return;
    if (!picked.length) return setState({ phase: 'choose', problem: TOO_LARGE });
    const file = picked[0];
    setState({ phase: 'reading' });
    const read = await readSheet(file.name, file.bytes);
    if (read.problems.length) {
      setState({ phase: 'choose', problem: `${file.name}: ${read.problems.join(' ')}` });
      return;
    }
    setState({
      phase: 'review',
      file: file.name,
      read,
      plan: planSheetImport(read, getLedger(), newId),
    });
  }, []);

  const approve = useCallback(async () => {
    if (state.phase !== 'review' || busy.current) return;
    busy.current = true;
    const plan = planSheetImport(state.read, getLedger(), newId);
    useExpenseStore.getState().addImported(plan);
    const cloud = isCloudActive(useSyncStatus.getState().status);
    setState({ phase: 'done', imported: plan, save: { state: cloud ? 'saving' : 'preview' } });
    if (cloud) {
      const allSent = await flushCloudSync();
      // Entries the database refused are taken out again (and named in a notice).
      const kept = new Set(getLedger().transactions.map((item) => item.id));
      const refused = plan.transactions.filter((item) => !kept.has(item.id)).length;
      const save: ImportSave =
        allSent && !refused ? { state: 'saved' } : { state: 'notSaved', refused };
      setState((current) =>
        current.phase === 'done' && current.imported === plan ? { ...current, save } : current,
      );
    }
    busy.current = false;
  }, [state]);

  const undo = useCallback(() => {
    if (state.phase !== 'done') return;
    const { rules } = useRecurringStore.getState();
    useExpenseStore.getState().restoreLedger(withoutImported(getLedger(), state.imported, rules));
    setState({ phase: 'choose', problem: null });
  }, [state]);

  const reset = useCallback(() => setState({ phase: 'choose', problem: null }), []);

  return { state, choose, approve, undo, reset };
}
