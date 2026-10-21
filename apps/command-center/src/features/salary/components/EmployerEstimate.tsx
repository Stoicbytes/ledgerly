import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { amountToInput, parseLimitedAmount } from '@/lib/domain/expenses';
import { estimateEmployerShare } from '@/lib/domain/salary';
import type { PayslipDraft } from '../payslipDraft';

const amount = (text: string) => (text.trim() ? (parseLimitedAmount(text) ?? 0) : 0);
const NOTE = 'Employer PF estimated; check the EPFO passbook.';

/**
 * For payslips that do not print the employer's PF: fills it in by the statutory rule, only
 * when asked, and says it is an estimate (in the form and in the payslip's note).
 */
export function EmployerEstimate({
  draft,
  onApply,
}: {
  draft: PayslipDraft;
  onApply: (patch: Partial<PayslipDraft>) => void;
}) {
  const [estimated, setEstimated] = useState(false);
  const employee = amount(draft.epfEmployee);
  const printed = amount(draft.employerEpf) > 0 || amount(draft.employerEps) > 0;
  if (estimated && printed) {
    return (
      <Text variant="caption" color="warning">
        Employer PF and EPS are estimated (12% of the PF wage; pension 8.33%, at most ₹1,250 a
        month). Check them in your EPFO passbook.
      </Text>
    );
  }
  if (printed || employee <= 0) return null;
  const apply = () => {
    const share = estimateEmployerShare(employee);
    const note = draft.note.includes(NOTE)
      ? draft.note
      : [draft.note.trim(), NOTE].filter(Boolean).join(' ');
    onApply({
      employerEpf: amountToInput(share.employerEpf),
      employerEps: amountToInput(share.employerEps),
      note,
    });
    setEstimated(true);
  };
  return (
    <View style={{ gap: 6, alignItems: 'flex-start' }}>
      <Text variant="caption" color="textSecondary">
        The employer’s PF is not filled in. If your payslip does not show it, it can be estimated
        from your PF.
      </Text>
      <Button label="Estimate employer share" variant="secondary" size="sm" onPress={apply} />
    </View>
  );
}
