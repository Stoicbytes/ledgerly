import { useState } from 'react';
import { View } from 'react-native';
import { FileText } from '@/components/icons';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import { canPickFiles } from '@/features/investments/import/pickFiles';
import { useTheme } from '@/theme';
import { IncomeFields } from '../components/PayslipFields';
import type { IncomeTarget } from '../state/salaryActions';
import { useSalaryStore } from '../state/salaryStore';
import { importStatus } from './importDraft';
import { ImportBox, ImportPayslipCard } from './ImportPayslipCard';
import { PasswordCard } from './PasswordCard';
import type { ImportItem, PayslipImport } from './usePayslipImport';

const plural = (count: number) => `${count} ${count === 1 ? 'payslip' : 'payslips'}`;

/** Choose payslip files, then review what each one says before anything is saved. */
export function PayslipImportSheet({
  flow,
  onReview,
  onClose,
}: {
  flow: PayslipImport;
  onReview: (item: ImportItem) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const toast = useToast();
  const { employers, payslips } = useSalaryStore();
  const [income, setIncome] = useState<IncomeTarget>(null);
  const statuses = new Map(
    flow.items.flatMap((item) =>
      item.slip ? [[item.key, importStatus(item.slip, employers, payslips)] as const] : [],
    ),
  );
  const ready = flow.items.filter(
    (item) => item.status === 'ready' && statuses.get(item.key)?.clean,
  ).length;
  const saveAll = () => {
    const saved = flow.saveAll(income);
    toast.show({ message: `Saved ${plural(saved)} with their PF contributions.` });
  };
  const review = flow.items.length > 0;
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Import payslips"
      description="Read payslips from PDF, CSV or Excel files. You check every figure before anything is saved."
      width={620}
      footer={
        <>
          <Button label="Close" variant="secondary" onPress={onClose} />
          <View style={{ flex: 1 }} />
          <Button
            label={flow.reading ? 'Reading…' : review ? 'More files' : 'Choose files'}
            icon={FileText}
            variant={review ? 'secondary' : 'primary'}
            disabled={!canPickFiles || flow.reading}
            onPress={() => void flow.choose()}
          />
          {review ? (
            <Button label={`Save all (${ready})`} disabled={!ready} onPress={saveAll} />
          ) : null}
        </>
      }
    >
      <View style={{ gap: theme.space[3] }}>
        {!review ? (
          <>
            <Text color="textSecondary">
              Choose one or more payslips (a whole year at once is fine). Any employer’s format
              works when the PDF has text; scanned payslips have to be added by hand.
            </Text>
            <Text variant="caption" color="textTertiary">
              Files are read on this device: nothing is uploaded, and files and passwords are not
              kept. Identity numbers on the payslip (UAN, PAN, account numbers) are ignored.
            </Text>
            {!canPickFiles ? (
              <Text variant="caption" color="warning">
                Choosing files works in the web app for now; it comes to the phone app with its next
                build.
              </Text>
            ) : null}
          </>
        ) : null}
        {flow.items.map((item) => {
          if (item.status === 'password') {
            return (
              <PasswordCard
                key={item.key}
                file={item.file}
                wrong={Boolean(item.wrongPassword)}
                onOpen={(password) => flow.unlock(item.key, password)}
                onSkip={() => flow.setStatus(item.key, 'skipped')}
              />
            );
          }
          const status = statuses.get(item.key);
          if (!item.slip || !status) {
            return item.status === 'skipped' ? null : (
              <ImportBox key={item.key}>
                <Text variant="bodyStrong">{item.file}</Text>
                <Text color="warning">{item.problem}</Text>
              </ImportBox>
            );
          }
          return (
            <ImportPayslipCard
              key={item.key}
              item={item}
              slip={item.slip}
              status={status}
              onReview={() => onReview(item)}
              onSkip={() => flow.setStatus(item.key, 'skipped')}
              onAddEmployer={flow.addEmployer}
            />
          );
        })}
        {review ? (
          <View style={{ gap: theme.space[2], marginTop: theme.space[2] }}>
            <Text variant="caption" color="textTertiary">
              Save all saves the payslips whose totals match and that need no checks. Each one adds
              its month’s PF contribution, as when added by hand.
            </Text>
            <IncomeFields target={income} linked={false} onChange={setIncome} />
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}
