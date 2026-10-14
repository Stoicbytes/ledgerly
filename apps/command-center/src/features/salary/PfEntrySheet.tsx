import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { ChipField } from '@/features/investments/components/ChipField';
import { DateField } from '@/features/investments/components/DateField';
import { amountToInput, todayIso } from '@/lib/domain/expenses';
import { financialYear } from '@/lib/domain/investments';
import { fyLabel, fyStartYear, PF_KIND_LABELS, type PfKind } from '@/lib/domain/salary';
import { formatMoney } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { MonthField } from './components/MonthField';
import {
  interestEstimate,
  parseRate,
  pfDraftFrom,
  readPfDraft,
  type PfDraft,
} from './pfEntryDraft';
import { deletePfEntry, savePfEntry } from './state/salaryActions';
import { useSalaryStore } from './state/salaryStore';

const KINDS: PfKind[] = ['opening', 'interest', 'withdrawal', 'contribution'];
const HINTS: Record<PfKind, string> = {
  opening: 'Your PF balance on a date, from the passbook, if you start tracking mid-way.',
  interest: 'Credited once a year, "updated up to 31 March". Enter it from the passbook.',
  withdrawal: 'An advance or a final settlement, from each share.',
  contribution: 'A month without a payslip here. Months with a payslip are added from it.',
};

/** A passbook entry: opening balance, a year's interest, a withdrawal or a contribution. */
export function PfEntrySheet({
  entryId,
  kind,
  fy,
  onClose,
}: {
  entryId: string | null;
  kind: PfKind;
  /** For interest: the financial year to start on. */
  fy?: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const toast = useToast();
  const { employers, pfEntries } = useSalaryStore();
  const entry = entryId ? (pfEntries.find((item) => item.id === entryId) ?? null) : null;
  const [draft, setDraft] = useState<PfDraft>(() => {
    const start = pfDraftFrom(entry, kind, employers.find((item) => !item.leftOn)?.id ?? null);
    return fy && !entry ? { ...start, fy } : start;
  });
  const [error, setError] = useState<string | undefined>();
  const change = (patch: Partial<PfDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(undefined);
  };
  const lastStart = fyStartYear(financialYear(todayIso())) - 1;
  const years = Array.from({ length: 6 }, (_, index) => fyLabel(lastStart - index));
  const rate = parseRate(draft.rate);
  const others = pfEntries.filter((item) => item.id !== entryId);
  const estimate =
    draft.kind === 'interest' && rate ? interestEstimate(others, draft.fy, rate) : null;
  const save = () => {
    const result = readPfDraft(draft);
    if ('error' in result) return setError(result.error);
    savePfEntry(result.input, entryId);
    toast.show({ message: entry ? 'PF entry saved' : 'PF entry added' });
    onClose();
  };
  const remove = () => {
    const undo = entry ? deletePfEntry(entry.id) : null;
    if (undo) toast.show({ message: 'PF entry deleted', action: { label: 'Undo', onPress: undo } });
    onClose();
  };
  const amount = (key: 'employee' | 'vpf' | 'employer' | 'pension', label: string) => (
    <View style={{ flexBasis: 180, flexGrow: 1 }}>
      <TextField
        label={label}
        money
        value={draft[key]}
        onChangeText={(text) => change({ [key]: text })}
        placeholder="0"
      />
    </View>
  );
  return (
    <Sheet
      visible
      onClose={onClose}
      title={entry ? `Edit ${PF_KIND_LABELS[draft.kind].toLowerCase()}` : 'Add PF entry'}
      description={HINTS[draft.kind]}
      footer={
        <>
          {entry ? <Button label="Delete" variant="danger" size="sm" onPress={remove} /> : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label={entry ? 'Save' : 'Add'} onPress={save} />
        </>
      }
    >
      <View style={{ gap: theme.space[4] }}>
        {entry ? null : (
          <ChipField<PfKind>
            label="Type"
            options={KINDS.map((value) => ({ value, label: PF_KIND_LABELS[value] }))}
            value={draft.kind}
            onChange={(next) => change({ kind: next })}
          />
        )}
        {draft.kind === 'interest' ? (
          <>
            <ChipField
              label="Financial year"
              options={years}
              value={draft.fy}
              onChange={(fy) => change({ fy })}
            />
            <TextField
              label="Rate EPFO declared (%)"
              value={draft.rate}
              onChangeText={(text) => change({ rate: text })}
              inputMode="decimal"
              keyboardType="decimal-pad"
              placeholder="e.g. 8.25"
              hint="The rate for that year, from the EPFO notice or your passbook."
            />
            {estimate ? (
              <View style={{ gap: theme.space[2] }}>
                <Text variant="caption" color="textSecondary">
                  Estimate at {rate} %, check your passbook:{' '}
                  {formatMoney(estimate.employee + estimate.employer)} (yours{' '}
                  {formatMoney(estimate.employee)}, employer {formatMoney(estimate.employer)}). Each
                  month’s contribution counts from the month after, when it is deposited; EPFO’s
                  figure can differ and the passbook is the record.
                </Text>
                <Button
                  label="Use the estimate"
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    change({
                      employee: amountToInput(estimate.employee),
                      employer: amountToInput(estimate.employer),
                    })
                  }
                />
              </View>
            ) : null}
          </>
        ) : draft.kind === 'contribution' ? (
          <>
            <ChipField
              label="Employer"
              options={employers.map((item) => ({ value: item.id, label: item.name }))}
              value={draft.employerId}
              onChange={(employerId) => change({ employerId })}
            />
            <MonthField
              label="Wage month"
              value={draft.month}
              onChange={(month) => change({ month })}
            />
          </>
        ) : (
          <DateField label="Date" value={draft.date} onChange={(date) => change({ date })} />
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
          {amount(
            'employee',
            draft.kind === 'interest' ? 'Interest on your share' : 'Your share (EPF)',
          )}
          {draft.kind === 'contribution' ? amount('vpf', 'Voluntary PF (VPF)') : null}
          {amount(
            'employer',
            draft.kind === 'interest' ? "Interest on employer's share" : 'Employer share (EPF)',
          )}
          {draft.kind === 'contribution' || draft.kind === 'opening'
            ? amount('pension', 'Pension (EPS)')
            : null}
        </View>
        <TextField
          label="Note"
          value={draft.note}
          onChangeText={(note) => change({ note })}
          maxLength={300}
        />
        {error ? <Text color="danger">{error}</Text> : null}
      </View>
    </Sheet>
  );
}
