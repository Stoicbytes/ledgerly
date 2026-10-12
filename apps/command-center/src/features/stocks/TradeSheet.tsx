import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button, SegmentedControl, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { DateField } from '@/features/investments/components/DateField';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { amountToInput, todayIso } from '@/lib/domain/expenses';
import {
  validateTrade,
  type TradeDraft,
  type TradeErrors,
  type TradeKind,
} from '@/lib/domain/investments';
import { useTheme } from '@/theme';

const KINDS: { value: TradeKind; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'split', label: 'Split' },
];

type Props = { stockId: string; tradeId: string | null; onClose: () => void };

/** Record or edit a buy, sell, dividend, bonus issue or split. */
export function TradeSheet({ stockId, tradeId, onClose }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const store = usePortfolioStore();
  const stock = store.stocks.find((item) => item.id === stockId);
  const existing = tradeId ? store.trades.find((trade) => trade.id === tradeId) : undefined;
  const [draft, setDraft] = useState<TradeDraft>(() => ({
    kind: existing?.kind ?? 'buy',
    date: existing?.date ?? todayIso(),
    quantityText: existing?.quantity ? String(existing.quantity) : '',
    priceText: existing?.price ? amountToInput(existing.price) : '',
    chargesText: existing?.charges ? amountToInput(existing.charges) : '',
    amountText: existing?.amount ? amountToInput(existing.amount) : '',
    ratioFromText: existing?.ratioFrom ? String(existing.ratioFrom) : '1',
    ratioToText: existing?.ratioTo ? String(existing.ratioTo) : '1',
    note: existing?.note ?? '',
  }));
  const [errors, setErrors] = useState<TradeErrors>({});
  if (!stock) return null;
  const others = store.trades.filter((trade) => trade.stockId === stockId && trade.id !== tradeId);
  const update = (patch: Partial<TradeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  };
  const save = () => {
    const { value, errors: found } = validateTrade(draft, others);
    if (!value) return setErrors(found);
    store.saveTrade(stockId, value, tradeId);
    toast.show({ message: existing ? 'Trade saved' : 'Trade added' });
    onClose();
  };
  const remove = () => {
    if (!existing) return;
    if (!store.deleteTrade(existing.id)) {
      setErrors({ quantity: 'A later sale needs these shares. Delete or change it first.' });
      return;
    }
    toast.show({ message: 'Trade deleted' });
    onClose();
  };
  const { kind } = draft;
  const ratio = kind === 'bonus' || kind === 'split';
  return (
    <Sheet
      visible
      onClose={onClose}
      title={existing ? 'Edit trade' : 'Add trade'}
      description={`${stock.symbol} · ${stock.name}`}
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
          value={kind}
          onChange={(next) => update({ kind: next })}
          segments={KINDS}
        />
        <DateField
          label={ratio ? 'Ex-date' : 'Trade date'}
          value={draft.date}
          onChange={(date) => update({ date })}
          error={errors.date}
        />
        {kind === 'buy' || kind === 'sell' ? (
          <>
            <TextField
              label="Shares"
              inputMode="numeric"
              keyboardType="number-pad"
              value={draft.quantityText}
              onChangeText={(quantityText) => update({ quantityText })}
              placeholder="10"
              error={errors.quantity}
            />
            <TextField
              label="Price per share"
              money
              value={draft.priceText}
              onChangeText={(priceText) => update({ priceText })}
              placeholder="2,950.50"
              error={errors.price}
            />
            <TextField
              label="Charges"
              money
              value={draft.chargesText}
              onChangeText={(chargesText) => update({ chargesText })}
              placeholder="0"
              hint="Brokerage, STT, exchange fees and GST from the contract note."
              error={errors.charges}
            />
          </>
        ) : null}
        {kind === 'dividend' ? (
          <TextField
            label="Dividend received"
            money
            value={draft.amountText}
            onChangeText={(amountText) => update({ amountText })}
            placeholder="120"
            error={errors.amount}
          />
        ) : null}
        {ratio ? (
          <View style={{ gap: 6 }}>
            <Text variant="label" color="textSecondary">
              {kind === 'bonus' ? 'New shares : shares held' : 'Old shares → new shares'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={kind === 'bonus' ? 'New' : 'From'}
                  inputMode="numeric"
                  value={kind === 'bonus' ? draft.ratioToText : draft.ratioFromText}
                  onChangeText={(text) =>
                    update(kind === 'bonus' ? { ratioToText: text } : { ratioFromText: text })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={kind === 'bonus' ? 'Held' : 'To'}
                  inputMode="numeric"
                  value={kind === 'bonus' ? draft.ratioFromText : draft.ratioToText}
                  onChangeText={(text) =>
                    update(kind === 'bonus' ? { ratioFromText: text } : { ratioToText: text })
                  }
                />
              </View>
            </View>
            <Text
              variant="caption"
              color={errors.ratio || errors.quantity ? 'danger' : 'textTertiary'}
            >
              {errors.ratio ??
                errors.quantity ??
                (kind === 'bonus'
                  ? '1 : 1 gives one new share for every share held. Bonus shares cost nothing.'
                  : 'A face value of ₹10 split to ₹2 is 1 → 5. Cost stays the same; fractions are paid in cash.')}
            </Text>
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
