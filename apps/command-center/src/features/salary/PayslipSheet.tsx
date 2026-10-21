import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { ChipField } from '@/features/investments/components/ChipField';
import { DateField } from '@/features/investments/components/DateField';
import { SwitchRow } from '@/features/investments/components/SwitchRow';
import { parseLimitedAmount, todayIso } from '@/lib/domain/expenses';
import { lineSuggestions } from '@/lib/domain/salary';
import { useTheme } from '@/theme';
import { MonthField } from './components/MonthField';
import { PayLinesEditor, type LineDraft } from './components/PayLinesEditor';
import { EmployerEstimate } from './components/EmployerEstimate';
import { IncomeFields, PayTotals, PfAmountFields } from './components/PayslipFields';
import { draftFrom, readDraft, type DraftErrors, type PayslipDraft } from './payslipDraft';
import { deletePayslip, savePayslip, type IncomeTarget } from './state/salaryActions';
import { useSalaryStore } from './state/salaryStore';

const sumLines = (lines: LineDraft[]) =>
  lines.reduce((total, line) => total + (parseLimitedAmount(line.amount) ?? 0), 0);

/**
 * Adds or edits a payslip: lines as printed, PF and tax, and the income entry. An import
 * opens it filled from a file (`initial`), with what to check (`notices`).
 */
export function PayslipSheet({
  payslipId,
  onClose,
  initial,
  notices = [],
  onSaved,
}: {
  payslipId: string | null;
  onClose: () => void;
  initial?: PayslipDraft;
  notices?: string[];
  onSaved?: () => void;
}) {
  const theme = useTheme();
  const toast = useToast();
  const { employers, payslips } = useSalaryStore();
  const slip = payslipId ? (payslips.find((item) => item.id === payslipId) ?? null) : null;
  const latest = [...payslips].sort((a, b) => b.month.localeCompare(a.month))[0] ?? null;
  const [draft, setDraft] = useState<PayslipDraft>(
    () =>
      initial ??
      draftFrom(slip, latest, employers.find((item) => !item.leftOn)?.id ?? employers[0]?.id ?? ''),
  );
  const linked = useExpenseStore((state) =>
    state.transactions.find((item) => item.id === slip?.transactionId),
  );
  // An income entry made before follows the payslip unless switched off.
  const [income, setIncome] = useState<IncomeTarget>(() =>
    linked ? { accountId: linked.accountId, categoryId: linked.categoryId } : null,
  );
  const [errors, setErrors] = useState<DraftErrors>({});
  const change = (patch: Partial<PayslipDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  };
  const gross = sumLines(draft.earnings);
  const deductions =
    sumLines(draft.deductions) +
    (['epfEmployee', 'vpf', 'tds'] as const).reduce(
      (total, field) => total + (parseLimitedAmount(draft[field]) ?? 0),
      0,
    );
  const save = () => {
    const result = readDraft(draft, payslips, payslipId);
    if (result.errors) return setErrors(result.errors);
    savePayslip(result.input, payslipId, income);
    toast.show({ message: slip ? 'Payslip saved' : 'Payslip added' });
    onSaved?.();
    onClose();
  };
  const remove = () => {
    const undo = slip ? deletePayslip(slip.id) : null;
    if (undo)
      toast.show({
        message: 'Payslip deleted with its PF contribution. An income entry stays.',
        action: { label: 'Undo', onPress: undo },
      });
    onClose();
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={slip ? 'Edit payslip' : 'Add payslip'}
      description={
        initial
          ? 'Read from your file. Check every figure against the payslip, then save.'
          : 'Enter the lines as your payslip prints them.'
      }
      footer={
        <>
          {slip && !initial ? (
            <Button label="Delete" variant="danger" size="sm" onPress={remove} />
          ) : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button
            label={slip ? 'Save' : 'Add payslip'}
            onPress={save}
            disabled={!employers.length}
          />
        </>
      }
    >
      <View style={{ gap: theme.space[4] }}>
        {notices.map((notice) => (
          <Text key={notice} color="warning">
            {notice}
          </Text>
        ))}
        {employers.length ? (
          <ChipField
            label="Employer"
            options={employers.map((item) => ({ value: item.id, label: item.name }))}
            value={draft.employerId}
            onChange={(employerId) => change({ employerId })}
          />
        ) : (
          <Text color="warning">Add your employer first (Employers tab).</Text>
        )}
        <MonthField label="Pay month" value={draft.month} onChange={(month) => change({ month })} />
        <SwitchRow
          label="Paid on a known date"
          value={draft.paidOn !== null}
          onChange={(on) => change({ paidOn: on ? todayIso() : null })}
        />
        {draft.paidOn !== null ? (
          <DateField
            label="Paid on"
            value={draft.paidOn}
            onChange={(paidOn) => change({ paidOn })}
          />
        ) : null}
        <PayLinesEditor
          title="Earnings"
          lines={draft.earnings}
          onChange={(earnings) => change({ earnings })}
          suggestions={lineSuggestions(payslips, 'earnings')}
          error={errors.earnings}
        />
        <PayLinesEditor
          title="Other deductions"
          lines={draft.deductions}
          onChange={(lines) => change({ deductions: lines })}
          suggestions={lineSuggestions(payslips, 'deductions')}
          error={errors.deductions}
        />
        <PfAmountFields
          draft={draft}
          errors={errors}
          onChange={(field, value) => change({ [field]: value })}
        />
        <EmployerEstimate draft={draft} onApply={change} />
        <PayTotals gross={gross} deductions={deductions} />
        <IncomeFields target={income} linked={Boolean(linked)} onChange={setIncome} />
        <TextField
          label="Note"
          value={draft.note}
          onChangeText={(note) => change({ note })}
          maxLength={300}
        />
        {errors.form ? <Text color="danger">{errors.form}</Text> : null}
      </View>
    </Sheet>
  );
}
