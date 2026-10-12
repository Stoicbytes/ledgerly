import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { ConfirmSheet, Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { ChipField } from '@/features/investments/components/ChipField';
import { DateField } from '@/features/investments/components/DateField';
import { SwitchRow } from '@/features/investments/components/SwitchRow';
import { usePortfolioStore, type StockInput } from '@/features/investments/state/portfolioStore';
import { amountToInput, parseLimitedAmount, todayIso } from '@/lib/domain/expenses';
import { isValidInvestmentDate, normaliseSymbol } from '@/lib/domain/investments';
import { useTheme } from '@/theme';
import { StockSearch } from './StockSearch';

const SECTORS = [
  'Financials',
  'Technology',
  'Energy',
  'Consumer',
  'Healthcare',
  'Industrials',
  'Automobile',
  'Materials',
  'Utilities',
  'Telecom',
  'Real estate',
  'Other',
];

type Props = { stockId: string | null; onClose: () => void; onSaved: (id: string | null) => void };

/** Add a stock (from the exchange list or by hand) or edit, archive or delete one. */
export function StockEditSheet({ stockId, onClose, onSaved }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const store = usePortfolioStore();
  const stock = stockId ? store.stocks.find((item) => item.id === stockId) : undefined;
  const [input, setInput] = useState<StockInput>(() => ({
    isin: stock?.isin ?? null,
    symbol: stock?.symbol ?? '',
    exchange: stock?.exchange ?? 'NSE',
    name: stock?.name ?? '',
    sector: stock?.sector ?? '',
    manualPrice: stock?.manualPrice ?? null,
    manualPriceDate: stock?.manualPriceDate ?? null,
    note: stock?.note ?? '',
    archived: stock?.archived ?? false,
  }));
  const [priceText, setPriceText] = useState(
    stock?.manualPrice ? amountToInput(stock.manualPrice) : '',
  );
  const [priceDate, setPriceDate] = useState(stock?.manualPriceDate ?? todayIso());
  const [errors, setErrors] = useState<{ symbol?: string; name?: string; price?: string }>({});
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<StockInput>) => {
    setInput((current) => ({ ...current, ...patch }));
    setErrors({});
  };
  const save = () => {
    const symbol = normaliseSymbol(input.symbol);
    const price = priceText.trim() ? parseLimitedAmount(priceText) : null;
    const taken = store.stocks.some(
      (item) => item.id !== stockId && item.symbol === symbol && item.exchange === input.exchange,
    );
    const next = {
      symbol: !symbol
        ? 'Enter the symbol, like INFY.'
        : taken
          ? 'This stock is already in your list.'
          : undefined,
      name: input.name.trim() ? undefined : 'Enter the company name.',
      price:
        priceText.trim() && (!price || !isValidInvestmentDate(priceDate))
          ? 'Enter a price like 1,505.25.'
          : undefined,
    };
    if (next.symbol || next.name || next.price || !symbol) return setErrors(next);
    const saved = store.saveStock(
      {
        ...input,
        symbol,
        name: input.name.trim(),
        manualPrice: price,
        manualPriceDate: price ? priceDate : null,
      },
      stockId,
    );
    toast.show({ message: stock ? `${saved.symbol} saved` : `${saved.symbol} added` });
    onSaved(saved.id);
  };
  const remove = () => {
    if (!stock) return;
    const previous = store.deleteStock(stock.id);
    toast.show({
      message: `${stock.symbol} deleted`,
      action: {
        label: 'Undo',
        onPress: () => usePortfolioStore.getState().restorePortfolio(previous),
      },
    });
    onSaved(null);
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={stock ? 'Edit stock' : 'Add stock'}
      width={560}
      footer={
        <>
          {stock ? (
            <Button label="Delete" variant="danger" size="sm" onPress={() => setConfirming(true)} />
          ) : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label={stock ? 'Save' : 'Add stock'} onPress={save} />
        </>
      }
    >
      <View style={{ gap: theme.space[4] }}>
        <StockSearch
          onPick={(match) =>
            set({
              isin: match.isin,
              symbol: match.symbol,
              name: match.name,
              exchange: match.exchange,
            })
          }
        />
        {input.isin ? (
          <Text variant="caption" color="textSecondary">
            Linked to ISIN {input.isin}: its closing price is updated automatically.
          </Text>
        ) : null}
        <TextField
          label="Symbol"
          value={input.symbol}
          onChangeText={(symbol) => set({ symbol: symbol.toUpperCase() })}
          autoCapitalize="characters"
          maxLength={30}
          placeholder="INFY"
          error={errors.symbol}
        />
        <ChipField
          label="Exchange"
          options={['NSE', 'BSE'] as const}
          value={input.exchange}
          onChange={(exchange) => set({ exchange })}
        />
        <TextField
          label="Company name"
          value={input.name}
          onChangeText={(name) => set({ name })}
          maxLength={200}
          placeholder="Infosys Ltd"
          error={errors.name}
        />
        <ChipField
          label="Sector"
          options={SECTORS}
          value={input.sector}
          onChange={(sector) => set({ sector })}
        />
        <TextField
          label="Price entered by hand"
          money
          value={priceText}
          onChangeText={(next) => {
            setPriceText(next);
            setErrors({});
          }}
          placeholder="Optional"
          hint="Used when there is no newer exchange closing price."
          error={errors.price}
        />
        {priceText.trim() ? (
          <DateField label="Price date" value={priceDate} onChange={setPriceDate} />
        ) : null}
        {stock ? (
          <SwitchRow
            label="Archive"
            hint="Hides the stock once it is sold. Its history stays."
            value={!!input.archived}
            onChange={(archived) => set({ archived })}
          />
        ) : null}
      </View>
      <ConfirmSheet
        visible={confirming}
        title={`Delete ${stock?.symbol ?? 'stock'}?`}
        message="This deletes the stock with all its trades. You can undo it right after."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          remove();
        }}
      />
    </Sheet>
  );
}
