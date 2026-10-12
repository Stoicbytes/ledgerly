import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, SegmentedControl, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { PickChip } from '@/features/expenses/entry/PickChip';
import { DateField } from '@/features/investments/components/DateField';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { amountToInput, parseAmount } from '@/lib/domain/expenses';
import {
  suggestStampDuty,
  unitsFor,
  validateFundTxn,
  type FundTxnDraft,
  type FundTxnErrors,
  type FundTxnKind,
} from '@/lib/domain/investments';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { initialDraft } from './fundTxnDraft';
import { NavLookup } from './NavLookup';

const KINDS: { value: FundTxnKind; label: string }[] = [
  { value: 'buy', label: 'Purchase' },
  { value: 'sell', label: 'Redemption' },
  { value: 'dividend', label: 'Dividend' },
];

type Props = {
  fundId: string;
  txnId: string | null;
  preset?: Partial<FundTxnDraft>;
  onClose: () => void;
};

/** Record or edit a purchase (lump sum or SIP), a redemption or a dividend paid out. */
export function FundTxnSheet({ fundId, txnId, preset, onClose }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const store = usePortfolioStore();
  const fund = store.funds.find((item) => item.id === fundId);
  const existing = txnId ? store.fundTxns.find((txn) => txn.id === txnId) : undefined;
  const sips = store.sips.filter((sip) => sip.fundId === fundId);
  const [draft, setDraft] = useState<FundTxnDraft>(() => initialDraft(existing, preset));
  const [dutyTouched, setDutyTouched] = useState(!!existing);
  const [errors, setErrors] = useState<FundTxnErrors>({});
  if (!fund) return null;
  const others = store.fundTxns.filter((txn) => txn.fundId === fundId && txn.id !== txnId);
  const update = (patch: Partial<FundTxnDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (!dutyTouched && next.kind === 'buy' && patch.amountText !== undefined) {
        const amount = parseAmount(next.amountText);
        next.stampDutyText = amount ? amountToInput(suggestStampDuty(amount)) : '';
      }
      return next;
    });
    setErrors({});
  };
  const amount = parseAmount(draft.amountText);
  const nav = Number(draft.navText);
  const estimate =
    draft.kind !== 'dividend' && amount && nav > 0
      ? unitsFor(amount, draft.kind === 'buy' ? (parseAmount(draft.stampDutyText) ?? 0) : 0, nav)
      : null;
  const save = () => {
    const { value, errors: found } = validateFundTxn(draft, others);
    if (!value) return setErrors(found);
    store.saveFundTxn(fundId, value, txnId);
    toast.show({ message: existing ? 'Transaction saved' : 'Transaction added' });
    onClose();
  };
  const remove = () => {
    if (!existing) return;
    if (!store.deleteFundTxn(existing.id)) {
      setErrors({ units: 'A later redemption needs these units. Delete or change it first.' });
      return;
    }
    toast.show({ message: 'Transaction deleted' });
    onClose();
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={existing ? 'Edit transaction' : 'Add transaction'}
      description={fund.name}
      footer={
        <>
          {existing ? <Button label="Delete" variant="danger" size="sm" onPress={remove} /> : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label={existing ? 'Save' : 'Add'} onPress={save} />
        </>
      }
    >
      <View style={{ gap: theme.space[4] }}>
        <SegmentedControl
          accessibilityLabel="Type"
          value={draft.kind}
          onChange={(kind) => update({ kind, sipId: kind === 'buy' ? draft.sipId : null })}
          segments={KINDS}
        />
        <DateField
          label={draft.kind === 'dividend' ? 'Paid on' : 'NAV date (allotment)'}
          value={draft.date}
          onChange={(date) => update({ date })}
          error={errors.date}
        />
        <TextField
          label={
            draft.kind === 'buy'
              ? 'Amount paid'
              : draft.kind === 'sell'
                ? 'Amount received'
                : 'Dividend paid'
          }
          money
          value={draft.amountText}
          onChangeText={(amountText) => update({ amountText })}
          placeholder="5,000"
          error={errors.amount}
        />
        {draft.kind !== 'dividend' ? (
          <>
            <NavLookup
              schemeCode={fund.schemeCode}
              date={draft.date}
              value={draft.navText}
              onChange={(navText) => update({ navText })}
              error={errors.nav}
            />
            {draft.kind === 'buy' ? (
              <TextField
                label="Stamp duty"
                money
                value={draft.stampDutyText}
                onChangeText={(stampDutyText) => {
                  setDutyTouched(true);
                  update({ stampDutyText });
                }}
                hint="0.005% of the amount, filled in for you. Change it to match your statement."
                error={errors.stampDuty}
              />
            ) : null}
            <TextField
              label="Units"
              inputMode="decimal"
              keyboardType="decimal-pad"
              value={draft.unitsText}
              onChangeText={(unitsText) => update({ unitsText })}
              placeholder={estimate ? String(estimate) : '86.025'}
              hint="Leave empty to work it out from the amount and NAV, or type it from your statement."
              error={errors.units}
            />
          </>
        ) : null}
        {draft.kind === 'buy' && sips.length ? (
          <View style={{ gap: 6 }}>
            <Text variant="label" color="textSecondary">
              Part of
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
              <PickChip
                label="Lump sum"
                selected={!draft.sipId}
                onPress={() => update({ sipId: null })}
              />
              {sips.map((sip) => (
                <PickChip
                  key={sip.id}
                  label={`SIP ${formatMoneyWhole(sip.amount)} on day ${sip.day}`}
                  selected={draft.sipId === sip.id}
                  onPress={() => update({ sipId: sip.id })}
                />
              ))}
            </View>
          </View>
        ) : null}
        <TextField
          label="Note"
          value={draft.note}
          onChangeText={(note) => update({ note })}
          maxLength={300}
          placeholder="Optional"
        />
      </View>
    </Sheet>
  );
}
