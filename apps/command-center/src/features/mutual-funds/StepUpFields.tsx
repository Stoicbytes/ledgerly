import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { stepUpProjection, stepUpSchedule } from '@/lib/domain/investments';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { TextField } from '../expenses/components/TextField';

/** Parses a yearly step-up like "10" or "7.5 %" (0–100, up to two decimals), else null. */
export function parseStepUp(input: string): number | null {
  const cleaned = input.replace(/[%\s]/g, '');
  if (!cleaned) return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value <= 100 ? value : null;
}

const YEARS = 10;

/**
 * Yearly step-up for a SIP, with the instalments it leads to and, for a return you type, an
 * estimate of what ten years of it could grow to (not saved; real returns vary).
 */
export function StepUpFields({
  amount,
  value,
  onChange,
  error,
}: {
  amount: number | null;
  value: string;
  onChange: (text: string) => void;
  error?: string;
}) {
  const theme = useTheme();
  const [returnText, setReturnText] = useState('');
  const step = parseStepUp(value);
  const rate = Number(returnText.replace('%', ''));
  const schedule = amount && step !== null ? stepUpSchedule(amount, step, 3) : [];
  const estimate =
    amount && step !== null && returnText.trim() && Number.isFinite(rate) && rate >= 0 && rate <= 30
      ? stepUpProjection(amount, step, YEARS, rate)
      : null;
  return (
    <View style={{ gap: theme.space[3] }}>
      <TextField
        label="Yearly step-up (%)"
        inputMode="decimal"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
        placeholder="0"
        hint="Raises the instalment every year from the start date, e.g. with your salary."
        error={error}
      />
      {schedule.length && step ? (
        <Text variant="caption" color="textSecondary">
          {`${schedule.map((item, index) => `Year ${index + 1}: ${formatMoneyWhole(item)}`).join(' · ')} …`}
        </Text>
      ) : null}
      <TextField
        label="Estimate at a yearly return of (%)"
        inputMode="decimal"
        keyboardType="decimal-pad"
        value={returnText}
        onChangeText={setReturnText}
        placeholder="e.g. 10"
        hint="Only for the estimate below; not saved."
      />
      {estimate ? (
        <Text variant="caption" color="textSecondary">
          {`In ${YEARS} years: ${formatMoneyWhole(estimate.invested)} put in, worth about ${formatMoneyWhole(estimate.value)} at ${rate}% a year. Real returns vary.`}
        </Text>
      ) : null}
    </View>
  );
}
