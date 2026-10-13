import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Download, Scale } from '@/components/icons';
import { EmptyState, useToast } from '@/components/feedback';
import { Button, Chip, Money, ScrollRow, Text } from '@/components/ui';
import { saveTextFile } from '@/lib/files/saveTextFile';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { dayLabel } from '@/lib/domain/expenses';
import {
  equityLtcgExemption,
  GAIN_TYPE_LABELS,
  gainLines,
  gainSummary,
  gainYears,
  grandfathered,
} from '@/lib/domain/investments';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { gainsCsv } from './gainsCsv';

/**
 * Gains on redemptions per financial year, split the way the tax return asks (equity
 * short and long term, debt at slab or by holding period), from the units each sale
 * used (first in, first out). A guide for filing, not the tax itself.
 */
export function CapitalGainsPanel() {
  const theme = useTheme();
  const toast = useToast();
  const funds = usePortfolioStore((state) => state.funds);
  const txns = usePortfolioStore((state) => state.fundTxns);
  const lines = useMemo(() => gainLines(funds, txns), [funds, txns]);
  const years = gainYears(lines);
  const [chosen, setChosen] = useState<string | null>(null);
  const fy = chosen ?? years[0] ?? null;
  const own = lines.filter((line) => line.fy === fy);
  const summary = fy ? gainSummary(lines, fy) : [];
  const equityLong = summary.find((item) => item.type === 'equityLong');
  const exportCsv = async () => {
    if (!fy) return;
    try {
      await saveTextFile(gainsCsv(own), `capital-gains-${fy.slice(3)}.csv`);
    } catch {
      toast.show({ message: 'Could not export. Try again.' });
    }
  };
  return (
    <View style={{ gap: theme.space[4] }}>
      <Text variant="caption" color="textSecondary">
        Redemptions by financial year, first in first out. A guide: check your CAMS or KFintech
        capital gains statement before filing.
      </Text>
      {!fy ? (
        <EmptyState
          icon={Scale}
          title="No redemptions yet"
          body="Gains appear here once you record a redemption."
        />
      ) : (
        <View style={{ gap: theme.space[4] }}>
          <Button
            label={`Export ${fy}`}
            icon={Download}
            variant="secondary"
            size="sm"
            onPress={exportCsv}
          />
          <ScrollRow accessibilityLabel="Financial year">
            {years.map((year) => (
              <Chip
                key={year}
                label={year}
                selected={year === fy}
                onPress={() => setChosen(year)}
              />
            ))}
          </ScrollRow>
          <View style={{ gap: theme.space[2] }}>
            {summary.map((item) => (
              <View
                key={item.type}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{GAIN_TYPE_LABELS[item.type]}</Text>
                  <Text variant="caption" color="textSecondary">
                    {`${item.count} ${item.count === 1 ? 'sale' : 'sales'} · sold for ${formatMoneyWhole(item.proceeds)} · cost ${formatMoneyWhole(item.cost)}`}
                  </Text>
                </View>
                <Money value={item.gain} tone="auto" variant="bodyStrong" />
              </View>
            ))}
          </View>
          {equityLong ? (
            <Text variant="caption" color="textSecondary">
              {`Equity long-term gains up to ${formatMoneyWhole(equityLtcgExemption(fy))} a year are exempt, counted across all your equity funds and shares together.`}
            </Text>
          ) : null}
          {own.some(grandfathered) ? (
            <Text variant="caption" color="textSecondary">
              Some units were bought before 1 February 2018: their cost can be raised to the 31
              January 2018 NAV (grandfathering), which lowers the gain shown here.
            </Text>
          ) : null}
          <View style={{ gap: theme.space[2] }}>
            <Text variant="title">Sales</Text>
            {own.map((line, index) => (
              <View
                key={`${line.fund.id}:${line.sellDate}:${index}`}
                style={{ flexDirection: 'row', gap: theme.space[3] }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1}>{line.fund.name}</Text>
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {`${dayLabel(line.buyDate, 'short')} → ${dayLabel(line.sellDate, 'short')} · ${line.days} days · ${GAIN_TYPE_LABELS[line.type]}`}
                  </Text>
                </View>
                <Money value={line.gain} tone="auto" variant="bodyStrong" />
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
