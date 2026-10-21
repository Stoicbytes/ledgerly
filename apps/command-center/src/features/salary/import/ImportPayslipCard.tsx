import { View } from 'react-native';
import { Badge, Button, Text } from '@/components/ui';
import { monthLabel } from '@/lib/domain/expenses';
import {
  detectedGross,
  detectedNet,
  type DetectedPayslip,
  type ImportField,
} from '@/lib/domain/salary/payslipImport';
import { formatMoney } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import type { ImportStatus } from './importDraft';
import type { ImportItem } from './usePayslipImport';

const FIELD_LABELS: Record<ImportField, string> = {
  month: 'month',
  employer: 'employer',
  earnings: 'earnings',
  deductions: 'deductions',
  pf: 'PF',
  tds: 'tax',
};

/** A box around one file's result in the review list. */
export function ImportBox({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        gap: theme.space[2],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {children}
    </View>
  );
}

/** One payslip read from a file: what it says, how its totals check, and what to do. */
export function ImportPayslipCard({
  item,
  slip,
  status,
  onReview,
  onSkip,
  onAddEmployer,
}: {
  item: ImportItem;
  slip: DetectedPayslip;
  status: ImportStatus;
  onReview: () => void;
  onSkip: () => void;
  onAddEmployer: (name: string) => void;
}) {
  const theme = useTheme();
  const unsure = (field: ImportField) => slip.unsure.includes(field);
  const done = item.status === 'saved' || item.status === 'skipped';
  return (
    <ImportBox>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.space[2],
          alignItems: 'center',
        }}
      >
        <Text
          variant="bodyStrong"
          color={slip.month && !unsure('month') ? 'textPrimary' : 'warning'}
        >
          {slip.month ? monthLabel(slip.month) : 'Month not found'}
        </Text>
        {item.status === 'saved' ? <Badge label="Saved" tone="success" /> : null}
        {item.status === 'skipped' ? <Badge label="Skipped" /> : null}
        {!done && status.existing ? <Badge label="Already added" tone="warning" /> : null}
        {!done && status.clean ? <Badge label="Totals match" tone="success" /> : null}
      </View>
      <Text variant="caption" color="textTertiary">
        {item.file}
      </Text>
      <Text color={status.employer && !unsure('employer') ? 'textSecondary' : 'warning'}>
        {status.employer
          ? status.employer.name
          : slip.employerName
            ? `New employer: ${slip.employerName}`
            : 'Employer not found'}
      </Text>
      <Text color="textSecondary">
        Gross {formatMoney(detectedGross(slip))} · Net {formatMoney(detectedNet(slip))}
      </Text>
      {!done ? (
        <>
          {status.warnings.map((warning) => (
            <Text key={warning} variant="caption" color="warning">
              {warning}
            </Text>
          ))}
          {!status.warnings.length && !status.clean ? (
            <Text variant="caption" color="success">
              The totals match the payslip.
            </Text>
          ) : null}
          {slip.unsure.length ? (
            <Text variant="caption" color="warning">
              Check the {slip.unsure.map((field) => FIELD_LABELS[field]).join(', ')}: read with less
              certainty.
            </Text>
          ) : null}
          {status.existing ? (
            <Text variant="caption" color="textSecondary">
              A payslip for this employer and month is already in the app. Replace it with this one,
              or skip.
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
            {!status.employer && slip.employerName ? (
              <Button
                label="Add employer"
                size="sm"
                variant="secondary"
                onPress={() => onAddEmployer(slip.employerName!)}
              />
            ) : null}
            <Button
              label={status.existing ? 'Replace' : 'Review and save'}
              size="sm"
              onPress={onReview}
            />
            <Button label="Skip" size="sm" variant="ghost" onPress={onSkip} />
          </View>
        </>
      ) : null}
    </ImportBox>
  );
}
