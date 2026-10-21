import { useCallback, useRef, useState } from 'react';
import { pickFiles, type PickedFile } from '@/features/investments/import/pickFiles';
import type { DetectedPayslip } from '@/lib/domain/salary/payslipImport';
import { readDraft } from '../payslipDraft';
import { saveEmployer, savePayslip, type IncomeTarget } from '../state/salaryActions';
import { useSalaryStore } from '../state/salaryStore';
import { draftFromImport, importStatus } from './importDraft';
import { readPayslipFile, type FileRead } from './readPayslipFile';

export type ImportItem = {
  key: string;
  file: string;
  status: 'password' | 'ready' | 'problem' | 'saved' | 'skipped';
  /** A password was tried and did not open the file. */
  wrongPassword?: boolean;
  problem?: string;
  slip?: DetectedPayslip;
};

const ACCEPT =
  '.pdf,.csv,.xlsx,.jpg,.jpeg,.png,application/pdf,text/csv,image/jpeg,image/png,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** One item per payslip found, or one for a file that needs its password or cannot be read. */
function itemsFrom(key: string, file: string, read: FileRead): ImportItem[] {
  if (read.kind === 'password')
    return [{ key, file, status: 'password', wrongPassword: read.wrong }];
  if (read.kind === 'problem') return [{ key, file, status: 'problem', problem: read.message }];
  return read.slips.map((slip, i) => ({ key: `${key}#${i}`, file, status: 'ready', slip }));
}

/**
 * Choose payslip files → (passwords) → review. Files are read in memory on this device; a
 * file waiting for its password is held only until it is opened or skipped, and passwords
 * are never stored. Nothing is saved until the owner saves a payslip (or Save all).
 */
export function usePayslipImport() {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [reading, setReading] = useState(false);
  const waiting = useRef(new Map<string, PickedFile>());
  const batch = useRef(0);

  const replace = (key: string, next: ImportItem[]) =>
    setItems((current) => current.flatMap((item) => (item.key === key ? next : [item])));

  const choose = useCallback(async () => {
    const picked = await pickFiles({ accept: ACCEPT, multiple: true });
    if (!picked) return;
    setReading(true);
    const added: ImportItem[] = [];
    batch.current += 1;
    for (const [index, file] of picked.entries()) {
      const key = `${batch.current}-${index}`;
      const read = await readPayslipFile(file);
      if (read.kind === 'password') waiting.current.set(key, file);
      added.push(...itemsFrom(key, file.name, read));
    }
    if (!picked.length) {
      added.push({
        key: `${batch.current}-big`,
        file: 'Files',
        status: 'problem',
        problem: 'Each file must be under 5 MB.',
      });
    }
    setItems((current) => [...current, ...added]);
    setReading(false);
  }, []);

  /** Tries a password on a waiting file; the password is not kept anywhere. */
  const unlock = useCallback(async (key: string, password: string) => {
    const file = waiting.current.get(key);
    if (!file) return;
    const read = await readPayslipFile(file, password);
    if (read.kind !== 'password') waiting.current.delete(key);
    replace(key, itemsFrom(key, file.name, read));
  }, []);

  const setStatus = useCallback((key: string, status: ImportItem['status']) => {
    if (status === 'skipped') waiting.current.delete(key);
    setItems((current) => current.map((item) => (item.key === key ? { ...item, status } : item)));
  }, []);

  /** Adds the employer a payslip names (after the owner confirms). */
  const addEmployer = useCallback((name: string) => {
    saveEmployer({ name, joinedOn: null, leftOn: null, note: '' });
  }, []);

  /** Saves every payslip with nothing to check; returns how many were saved. */
  const saveAll = useCallback(
    (income: IncomeTarget) => {
      let saved = 0;
      for (const item of items) {
        if (item.status !== 'ready' || !item.slip) continue;
        const { employers, payslips } = useSalaryStore.getState();
        const status = importStatus(item.slip, employers, payslips);
        if (!status.clean || !status.employer) continue;
        const result = readDraft(draftFromImport(item.slip, status.employer.id), payslips, null);
        if (!result.input) continue;
        savePayslip(result.input, null, income);
        setStatus(item.key, 'saved');
        saved += 1;
      }
      return saved;
    },
    [items, setStatus],
  );

  const reset = useCallback(() => {
    waiting.current.clear();
    setItems([]);
  }, []);

  return { items, reading, choose, unlock, setStatus, addEmployer, saveAll, reset };
}

export type PayslipImport = ReturnType<typeof usePayslipImport>;
