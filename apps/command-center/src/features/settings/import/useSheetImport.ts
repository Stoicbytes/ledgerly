import { useCallback, useEffect, useRef, useState } from 'react';
import { getLedger, useExpenseStore } from '@/features/expenses/state/expenseStore';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { pickFiles } from '@/features/investments/import/pickFiles';
import {
  planSheetImport,
  readExpenseSheet,
  withoutImported,
  type SheetImportPlan,
  type SheetRead,
} from '@/lib/domain/expenses';
import { readCsvRows } from '@/lib/files/csv';
import { inflateRaw } from '@/lib/files/inflate';
import { readXlsxRows } from '@/lib/files/xlsx';
import { FileFormatError } from '@/lib/files/zip';
import { newId } from '@/lib/ids';
import {
  clearLastImport,
  lastImportKey,
  lastImportOf,
  readLastImport,
  saveLastImport,
  undoLastImport,
  type LastImport,
} from './lastImport';

export type SheetImportState =
  | { phase: 'choose'; problem: string | null }
  | { phase: 'reading' }
  | { phase: 'review'; file: string; read: SheetRead; plan: SheetImportPlan }
  | { phase: 'done'; imported: SheetImportPlan };

export const TOO_LARGE = 'The file is larger than 5 MB. Export a shorter period and import each.';

export async function readSheet(name: string, bytes: Uint8Array): Promise<SheetRead> {
  if (/\.xls$/i.test(name)) {
    const problem = 'This is an old .xls file. Open it and save it as .xlsx or .csv first.';
    return { rows: [], skipped: [], problems: [problem] };
  }
  try {
    const rows = /\.csv$/i.test(name)
      ? readCsvRows(new TextDecoder().decode(bytes))
      : await readXlsxRows(bytes, inflateRaw);
    return readExpenseSheet(rows);
  } catch (error) {
    const reason = error instanceof FileFormatError ? error.message : 'It could not be read.';
    return { rows: [], skipped: [], problems: [reason] };
  }
}

/**
 * Choose an export from another expense app → review → import. The file is read on this
 * device and not kept; nothing is added (or synced) until `approve`, which plans again
 * against the ledger as it is then (so edits made meanwhile, or a second press, add no
 * duplicates). `undo` removes exactly what was imported, keeping later changes.
 *
 * Signed in, the last import's ids are also kept on this device (`last`), so it can be
 * undone after a reload until it is dismissed. `ready` is true once the user's data has
 * loaded (an undo before that would find nothing to remove).
 */
export function useSheetImport(ready = false) {
  const [state, setState] = useState<SheetImportState>({ phase: 'choose', problem: null });
  const [last, setLast] = useState<LastImport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void (async () => {
      key.current = await lastImportKey();
      const saved = key.current ? await readLastImport(key.current) : null;
      if (live) setLast(saved);
    })();
    return () => {
      live = false;
    };
  }, [ready]);

  const forget = useCallback(() => {
    setLast(null);
    if (key.current) void clearLastImport(key.current);
  }, []);

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

  const approve = useCallback(() => {
    if (state.phase !== 'review' || busy.current) return;
    busy.current = true;
    const plan = planSheetImport(state.read, getLedger(), newId);
    useExpenseStore.getState().addImported(plan);
    busy.current = false;
    setNotice(null);
    setState({ phase: 'done', imported: plan });
    if (key.current && plan.transactions.length) {
      const saved = lastImportOf(plan);
      void saveLastImport(key.current, saved);
      setLast(saved);
    }
  }, [state]);

  const undo = useCallback(() => {
    if (state.phase !== 'done') return;
    const { rules } = useRecurringStore.getState();
    useExpenseStore.getState().restoreLedger(withoutImported(getLedger(), state.imported, rules));
    forget();
    setState({ phase: 'choose', problem: null });
  }, [state, forget]);

  /** Undoes the import kept on this device (after a reload). */
  const undoLast = useCallback(() => {
    if (!last) return;
    const removed = undoLastImport(last);
    forget();
    setNotice(`Import undone: ${removed} ${removed === 1 ? 'entry' : 'entries'} removed.`);
  }, [last, forget]);

  const reset = useCallback(() => setState({ phase: 'choose', problem: null }), []);

  return { state, choose, approve, undo, reset, last, undoLast, dismissLast: forget, notice };
}
