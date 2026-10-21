import { useState } from 'react';
import { PayslipSheet } from '../PayslipSheet';
import { useSalaryStore } from '../state/salaryStore';
import { draftFromImport, importStatus } from './importDraft';
import { PayslipImportSheet } from './PayslipImportSheet';
import { usePayslipImport, type ImportItem } from './usePayslipImport';

/**
 * The import: the review list, and the usual payslip form filled from one file. Saving goes
 * through the same path as adding by hand (or editing, to replace one already added), so
 * the PF contribution and the income entry behave the same.
 */
export function PayslipImportFlow({ onClose }: { onClose: () => void }) {
  const flow = usePayslipImport();
  const [editing, setEditing] = useState<ImportItem | null>(null);
  const { employers, payslips } = useSalaryStore();
  if (editing?.slip) {
    const status = importStatus(editing.slip, employers, payslips);
    const notices = [...status.warnings];
    if (!status.employer && editing.slip.employerName) {
      notices.push(`The payslip names “${editing.slip.employerName}”: choose the employer below.`);
    }
    return (
      <PayslipSheet
        payslipId={status.existing?.id ?? null}
        initial={draftFromImport(editing.slip, status.employer?.id ?? '')}
        notices={notices}
        onSaved={() => flow.setStatus(editing.key, 'saved')}
        onClose={() => setEditing(null)}
      />
    );
  }
  return <PayslipImportSheet flow={flow} onReview={setEditing} onClose={onClose} />;
}
