import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { DateField } from '@/features/investments/components/DateField';
import { SwitchRow } from '@/features/investments/components/SwitchRow';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { amountToInput, isValidIsoDate, parseAmount, todayIso } from '@/lib/domain/expenses';
import { isValidInvestmentDate, MAX_SIP_AMOUNT, parseWhole } from '@/lib/domain/investments';
import { useTheme } from '@/theme';
import { parseStepUp, StepUpFields } from './StepUpFields';

type Props = { fundId: string; sipId: string | null; onClose: () => void };

/** A monthly SIP plan: amount, day, start and optional end; can be paused. */
export function SipSheet({ fundId, sipId, onClose }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const store = usePortfolioStore();
  const fund = store.funds.find((item) => item.id === fundId);
  const sip = sipId ? store.sips.find((item) => item.id === sipId) : undefined;
  const [amountText, setAmountText] = useState(sip ? amountToInput(sip.amount) : '');
  const [dayText, setDayText] = useState(sip ? String(sip.day) : '5');
  const [startDate, setStartDate] = useState(sip?.startDate ?? todayIso());
  const [endDate, setEndDate] = useState<string | null>(sip?.endDate ?? null);
  const [active, setActive] = useState(sip?.active ?? true);
  // The step-up is saved from migration 0013 on (the goals flag marks it).
  const stepUpAvailable = useGoalStore((state) => state.available);
  const [stepText, setStepText] = useState(sip?.stepUpPct ? String(sip.stepUpPct) : '');
  const [errors, setErrors] = useState<{
    amount?: string;
    day?: string;
    start?: string;
    end?: string;
    step?: string;
  }>({});
  if (!fund) return null;
  const save = () => {
    const amount = parseAmount(amountText);
    const day = parseWhole(dayText);
    const next = {
      amount:
        amount && amount >= 100 && amount <= MAX_SIP_AMOUNT
          ? undefined
          : 'Enter the instalment, like 5,000.',
      day: day && day <= 28 ? undefined : 'Pick a day from 1 to 28.',
      end:
        endDate && (!isValidIsoDate(endDate) || endDate < startDate)
          ? 'The end must be after the start.'
          : undefined,
      start: isValidInvestmentDate(startDate) ? undefined : 'Pick a date from 1990 to 2100.',
      step: parseStepUp(stepText) === null ? 'Enter a yearly step-up from 0 to 100 %.' : undefined,
    };
    if (next.amount || next.day || next.end || next.start || next.step || !amount || !day)
      return setErrors(next);
    store.saveSip(
      {
        fundId,
        amount,
        day,
        startDate,
        endDate,
        active,
        note: sip?.note ?? '',
        stepUpPct: stepUpAvailable ? (parseStepUp(stepText) ?? 0) : (sip?.stepUpPct ?? 0),
      },
      sipId,
    );
    toast.show({ message: sip ? 'SIP saved' : 'SIP added' });
    onClose();
  };
  const remove = () => {
    if (!sip) return;
    store.deleteSip(sip.id);
    toast.show({ message: 'SIP deleted. Recorded instalments stay.' });
    onClose();
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={sip ? 'Edit SIP' : 'Add SIP'}
      description={fund.name}
      footer={
        <>
          {sip ? <Button label="Delete" variant="danger" size="sm" onPress={remove} /> : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label={sip ? 'Save' : 'Add SIP'} onPress={save} />
        </>
      }
    >
      <View style={{ gap: theme.space[4] }}>
        <TextField
          label="Monthly amount"
          money
          value={amountText}
          onChangeText={(next) => {
            setAmountText(next);
            setErrors({});
          }}
          placeholder="5,000"
          error={errors.amount}
        />
        <TextField
          label="Day of the month"
          inputMode="numeric"
          keyboardType="number-pad"
          value={dayText}
          onChangeText={(next) => {
            setDayText(next);
            setErrors({});
          }}
          maxLength={2}
          hint="1 to 28. Upcoming and missed instalments are shown on the Mutual funds page."
          error={errors.day}
        />
        <DateField label="Starts" value={startDate} onChange={setStartDate} error={errors.start} />
        <SwitchRow
          label="Has an end date"
          value={endDate !== null}
          onChange={(on) => setEndDate(on ? todayIso() : null)}
        />
        {endDate !== null ? (
          <DateField label="Ends" value={endDate} onChange={setEndDate} error={errors.end} />
        ) : null}
        {stepUpAvailable ? (
          <StepUpFields
            amount={parseAmount(amountText)}
            value={stepText}
            onChange={(text) => {
              setStepText(text);
              setErrors({});
            }}
            error={errors.step}
          />
        ) : null}
        <SwitchRow
          label="Active"
          hint="Turn off to pause reminders without deleting the plan."
          value={active}
          onChange={setActive}
        />
      </View>
    </Sheet>
  );
}
