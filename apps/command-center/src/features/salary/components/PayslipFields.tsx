import { View } from 'react-native';
import { Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { useExpenseStore } from '@/features/expenses/state/expenseStore';
import { ChipField } from '@/features/investments/components/ChipField';
import { SwitchRow } from '@/features/investments/components/SwitchRow';
import { topLevelCategories } from '@/lib/domain/expenses';
import { formatMoney } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import type { DraftErrors, PayslipDraft, PfField } from '../payslipDraft';
import type { IncomeTarget } from '../state/salaryActions';

const PF_LABELS: { field: PfField; label: string; hint?: string }[] = [
  { field: 'epfEmployee', label: 'Employee PF (EPF)' },
  { field: 'vpf', label: 'Voluntary PF (VPF)' },
  { field: 'tds', label: 'Income tax (TDS)' },
  { field: 'employerEpf', label: 'Employer PF (EPF)', hint: 'Not part of pay; goes to your PF.' },
  {
    field: 'employerEps',
    label: 'Employer pension (EPS)',
    hint: 'Not part of pay or the PF balance.',
  },
];

/** EPF, VPF, TDS and the employer's shares, as printed on the payslip. */
export function PfAmountFields({
  draft,
  errors,
  onChange,
}: {
  draft: PayslipDraft;
  errors: DraftErrors;
  onChange: (field: PfField, value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
      {PF_LABELS.map(({ field, label, hint }) => (
        <View key={field} style={{ flexBasis: 200, flexGrow: 1 }}>
          <TextField
            label={label}
            money
            value={draft[field]}
            onChangeText={(value) => onChange(field, value)}
            placeholder="0"
            hint={hint}
            error={errors[field]}
          />
        </View>
      ))}
    </View>
  );
}

/** Gross, deductions and net pay as the form stands. */
export function PayTotals({ gross, deductions }: { gross: number; deductions: number }) {
  const theme = useTheme();
  const items = [
    { label: 'Gross', value: gross },
    { label: 'Deductions', value: deductions },
    { label: 'Net pay', value: gross - deductions },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.space[3],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      {items.map((item) => (
        <View key={item.label} style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color="textSecondary">
            {item.label}
          </Text>
          <Text variant="bodyStrong" color={item.value < 0 ? 'danger' : 'textPrimary'}>
            {formatMoney(item.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Whether to record the net pay as an income entry, and where. */
export function IncomeFields({
  target,
  linked,
  onChange,
}: {
  target: IncomeTarget;
  linked: boolean;
  onChange: (target: IncomeTarget) => void;
}) {
  const accounts = useExpenseStore((state) => state.accounts);
  const categories = useExpenseStore((state) => state.categories);
  const incomeCategories = topLevelCategories(categories, 'income');
  const salary = incomeCategories.find((item) => /salary/i.test(item.name)) ?? incomeCategories[0];
  return (
    <View style={{ gap: 12 }}>
      <SwitchRow
        label={linked ? 'Update the income entry' : 'Record the net pay as income'}
        hint={
          linked
            ? 'The income entry made for this payslip follows its net pay and date.'
            : 'Adds an income entry for the net pay on the day it was paid.'
        }
        value={target !== null}
        onChange={(on) =>
          onChange(
            on && accounts[0]
              ? { accountId: accounts[0].id, categoryId: salary?.id ?? null }
              : null,
          )
        }
      />
      {target ? (
        <>
          <ChipField
            label="Paid into"
            options={accounts.map((item) => ({ value: item.id, label: item.name }))}
            value={target.accountId}
            onChange={(accountId) => onChange({ ...target, accountId })}
          />
          <ChipField
            label="Category"
            options={incomeCategories.map((item) => ({ value: item.id, label: item.name }))}
            value={target.categoryId}
            onChange={(categoryId) => onChange({ ...target, categoryId })}
          />
        </>
      ) : null}
    </View>
  );
}
