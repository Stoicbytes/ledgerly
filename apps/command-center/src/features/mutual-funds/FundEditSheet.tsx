import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { ConfirmSheet, Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { ChipField } from '@/features/investments/components/ChipField';
import { DateField } from '@/features/investments/components/DateField';
import { SwitchRow } from '@/features/investments/components/SwitchRow';
import { usePortfolioStore, type FundInput } from '@/features/investments/state/portfolioStore';
import { todayIso } from '@/lib/domain/expenses';
import { fundAssetClass, isValidInvestmentDate, parseDecimal } from '@/lib/domain/investments';
import { useTheme } from '@/theme';
import { FundSearch } from './FundSearch';
import { useFundExtras } from './useFundExtras';

/** Category choices for a fund entered by hand (AMFI funds bring their own). */
const CLASSES = [
  ['Equity', 'Equity Scheme'],
  ['Debt', 'Debt Scheme'],
  ['Hybrid', 'Hybrid Scheme'],
  ['Index & ETF', 'Other Scheme - Index Funds'],
  ['Gold & silver', 'Other Scheme - Gold FoF'],
  ['Other', 'Other Scheme'],
] as const;

type Props = { fundId: string | null; onClose: () => void; onSaved: (id: string | null) => void };

/** Add a fund (from the AMFI list or by hand) or edit, archive or delete one. */
export function FundEditSheet({ fundId, onClose, onSaved }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const store = usePortfolioStore();
  const fund = fundId ? store.funds.find((item) => item.id === fundId) : undefined;
  const [input, setInput] = useState<FundInput>(() => ({
    schemeCode: fund?.schemeCode ?? null,
    name: fund?.name ?? '',
    category: fund?.category ?? '',
    fundHouse: fund?.fundHouse ?? '',
    folio: fund?.folio ?? '',
    manualNav: fund?.manualNav ?? null,
    manualNavDate: fund?.manualNavDate ?? null,
    note: fund?.note ?? '',
    archived: fund?.archived ?? false,
  }));
  const [navText, setNavText] = useState(fund?.manualNav ? String(fund.manualNav) : '');
  const [navDate, setNavDate] = useState(fund?.manualNavDate ?? todayIso());
  const [errors, setErrors] = useState<{ name?: string; nav?: string }>({});
  const [confirming, setConfirming] = useState(false);
  const extras = useFundExtras(fund);
  const set = (patch: Partial<FundInput>) => setInput((current) => ({ ...current, ...patch }));
  const save = () => {
    const name = input.name.trim();
    const nav = navText.trim() ? parseDecimal(navText, 4) : null;
    const next = {
      name: name ? undefined : 'Enter the fund name.',
      nav:
        navText.trim() && (!nav || !isValidInvestmentDate(navDate))
          ? 'Enter a NAV like 58.1234.'
          : undefined,
    };
    if (next.name || next.nav) return setErrors(next);
    const more = extras.read();
    if (!more) return;
    const saved = store.saveFund(
      { ...input, ...more, name, manualNav: nav, manualNavDate: nav ? navDate : null },
      fundId,
    );
    toast.show({ message: fund ? `${saved.name} saved` : `${saved.name} added` });
    onSaved(saved.id);
  };
  const remove = () => {
    if (!fund) return;
    const previous = store.deleteFund(fund.id);
    toast.show({
      message: `${fund.name} deleted`,
      action: {
        label: 'Undo',
        onPress: () => usePortfolioStore.getState().restorePortfolio(previous),
      },
    });
    onSaved(null);
  };
  const txnCount = fund ? store.fundTxns.filter((txn) => txn.fundId === fund.id).length : 0;
  return (
    <Sheet
      visible
      onClose={onClose}
      title={fund ? 'Edit fund' : 'Add fund'}
      width={560}
      footer={
        <>
          {fund ? (
            <Button label="Delete" variant="danger" size="sm" onPress={() => setConfirming(true)} />
          ) : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label={fund ? 'Save' : 'Add fund'} onPress={save} />
        </>
      }
    >
      <View style={{ gap: theme.space[4] }}>
        <FundSearch
          onPick={(match) => {
            set({
              schemeCode: match.schemeCode,
              name: match.name,
              category: match.category,
              fundHouse: match.fundHouse,
              ...(match.isin ? { isin: match.isin } : {}),
            });
            setErrors({});
          }}
        />
        {input.schemeCode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
              Linked to AMFI scheme {input.schemeCode}: its NAV is updated automatically.
            </Text>
            <Button
              label="Unlink"
              variant="secondary"
              size="sm"
              onPress={() => set({ schemeCode: null })}
            />
          </View>
        ) : null}
        <TextField
          label="Fund name"
          value={input.name}
          onChangeText={(name) => {
            set({ name });
            setErrors({});
          }}
          maxLength={200}
          placeholder="e.g. Horizon Flexi Cap Fund - Direct - Growth"
          error={errors.name}
        />
        {!input.schemeCode ? (
          <ChipField
            label="Type"
            options={CLASSES.map(([label]) => label)}
            value={fundAssetClass(input.category)}
            onChange={(label) =>
              set({ category: CLASSES.find(([name]) => name === label)?.[1] ?? '' })
            }
          />
        ) : null}
        <TextField
          label="Folio number"
          value={input.folio}
          onChangeText={(folio) => set({ folio })}
          maxLength={40}
          placeholder="Optional"
        />
        {extras.fields}
        <TextField
          label="NAV entered by hand"
          inputMode="decimal"
          keyboardType="decimal-pad"
          value={navText}
          onChangeText={(next) => {
            setNavText(next);
            setErrors({});
          }}
          placeholder="Optional"
          hint="Used when there is no newer AMFI NAV (funds entered by hand, or before prices are set up)."
          error={errors.nav}
        />
        {navText.trim() ? (
          <DateField label="NAV date" value={navDate} onChange={setNavDate} />
        ) : null}
        {fund ? (
          <SwitchRow
            label="Archive"
            hint="Hides the fund once it has no units left. Its history stays."
            value={!!input.archived}
            onChange={(archived) => set({ archived })}
          />
        ) : null}
      </View>
      <ConfirmSheet
        visible={confirming}
        title={`Delete ${fund?.name ?? 'fund'}?`}
        message={`This deletes the fund with its ${txnCount} transactions and SIP plans. You can undo it right after.`}
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
