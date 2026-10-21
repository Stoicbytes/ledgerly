import { useState } from 'react';
import { Download } from '@/components/icons';
import { Button } from '@/components/ui';
import { canPickFiles } from '@/features/investments/import/pickFiles';
import { PayslipImportFlow } from './PayslipImportFlow';

/**
 * "Import payslips" beside "Add payslip"; files can be chosen in the web app only for now.
 * The PDF reader itself is downloaded only when a PDF is read (see readPayslipFile).
 */
export function ImportPayslipsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        label="Import payslips"
        variant="secondary"
        icon={Download}
        disabled={!canPickFiles}
        accessibilityHint={canPickFiles ? undefined : 'Works in the web app for now'}
        onPress={() => setOpen(true)}
      />
      {open ? <PayslipImportFlow onClose={() => setOpen(false)} /> : null}
    </>
  );
}
