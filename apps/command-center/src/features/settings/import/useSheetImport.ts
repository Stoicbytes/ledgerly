import { useCallback, useState } from 'react';
import { pickFiles } from '@/features/investments/import/pickFiles';
import { getLedger, useExpenseStore, type Ledger } from '@/features/expenses/state/expenseStore';
import {
  planSheetImport,
  readExpenseSheet,
  type SheetImportPlan,
  type SheetRead,
} from '@/lib/domain/expenses';
import { readCsvRows } from '@/lib/files/csv';
import { inflateRaw } from '@/lib/files/inflate';
import { readXlsxRows } from '@/lib/files/xlsx';
import { FileFormatError } from '@/lib/files/zip';
import { newId } from '@/lib/ids';

export type SheetImportState =
  | { phase: 'choose'; problem: string | null }
  | { phase: 'reading' }
  | { phase: 'review'; file: string; plan: SheetImportPlan }
  | { phase: 'done'; added: number; previous: Ledger };

async function readSheet(name: string, bytes: Uint8Array): Promise<SheetRead> {
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
 * device and not kept; nothing is added (or synced) until `approve`, and `undo` takes the
 * whole import back while the card is open.
 */
export function useSheetImport() {
  const [state, setState] = useState<SheetImportState>({ phase: 'choose', problem: null });

  const choose = useCallback(async () => {
    const picked = (await pickFiles())?.[0];
    if (!picked) return;
    setState({ phase: 'reading' });
    const read = await readSheet(picked.name, picked.bytes);
    if (read.problems.length) {
      setState({ phase: 'choose', problem: `${picked.name}: ${read.problems.join(' ')}` });
      return;
    }
    setState({
      phase: 'review',
      file: picked.name,
      plan: planSheetImport(read, getLedger(), newId),
    });
  }, []);

  const approve = useCallback(() => {
    if (state.phase !== 'review') return;
    const { accounts, categories, transactions } = state.plan;
    const previous = useExpenseStore.getState().addImported({ accounts, categories, transactions });
    setState({ phase: 'done', added: transactions.length, previous });
  }, [state]);

  const undo = useCallback(() => {
    if (state.phase !== 'done') return;
    useExpenseStore.getState().restoreLedger(state.previous);
    setState({ phase: 'choose', problem: null });
  }, [state]);

  const reset = useCallback(() => setState({ phase: 'choose', problem: null }), []);

  return { state, choose, approve, undo, reset };
}
