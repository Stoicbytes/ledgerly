import type { PfKind } from '@/lib/domain/salary';
import { EmployerSheet } from './EmployerSheet';
import { PayslipSheet } from './PayslipSheet';
import { PfEntrySheet } from './PfEntrySheet';

/** Which form is open on the Salary & PF page. */
export type SalaryPanel =
  | { type: 'payslip'; id: string | null }
  | { type: 'pf'; id: string | null; kind: PfKind; fy?: string }
  | { type: 'employer'; id: string | null }
  | null;

export function SalarySheets({ panel, onClose }: { panel: SalaryPanel; onClose: () => void }) {
  if (panel?.type === 'payslip') return <PayslipSheet payslipId={panel.id} onClose={onClose} />;
  if (panel?.type === 'employer') return <EmployerSheet employerId={panel.id} onClose={onClose} />;
  if (panel?.type === 'pf')
    return <PfEntrySheet entryId={panel.id} kind={panel.kind} fy={panel.fy} onClose={onClose} />;
  return null;
}
