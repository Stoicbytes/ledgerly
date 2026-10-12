import { View } from 'react-native';
import { Money, Text } from '@/components/ui';
import { parseIsoDate } from '@/lib/domain/expenses';
import type { BenchmarkComparison } from '@/lib/domain/investments';
import { formatMoneyWhole, formatPercent } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type Ok = Extract<BenchmarkComparison, { status: 'ok' }>;

export const dateText = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    parseIsoDate(iso),
  );

const xirrText = (value: number | null) => (value === null ? '—' : formatPercent(value * 100));

/** Your shares next to the same money in the index fund. */
export function BenchmarkResult({ result, fundName }: { result: Ok; fundName: string }) {
  const theme = useTheme();
  const difference = result.yourValue - result.indexValue;
  const verdict =
    difference === 0
      ? 'Your shares are level with the index.'
      : `Your shares are ${formatMoneyWhole(Math.abs(difference))} ${difference > 0 ? 'ahead of' : 'behind'} the index.`;
  return (
    <View style={{ gap: theme.space[4] }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[4] }}>
        <Figure label="Your shares now" value={result.yourValue} xirr={result.yourXirr} />
        <Figure
          label="Same money in the index fund"
          value={result.indexValue}
          xirr={result.indexXirr}
        />
      </View>
      <Text variant="bodyStrong" role="status">
        {verdict}
      </Text>
      <Text variant="caption" color="textSecondary">
        {`Both started from the same ${formatMoneyWhole(result.invested)} put in, with ${formatMoneyWhole(result.withdrawn)} taken out (sales after charges, and dividends) on the same dates. Return a year is shown once your first trade is a year old.`}
      </Text>
      {result.exhausted ? (
        <Text variant="caption" color="textSecondary">
          A sale took out more than the index fund holding had then (your shares had grown faster),
          so the fund holding counts as zero after it.
        </Text>
      ) : null}
      <Text variant="caption" color="textTertiary">
        {`Index fund: ${fundName}, at its NAV of ${dateText(result.navDate)}. Its NAV is after the fund's costs and with dividends reinvested. Past returns, not advice.`}
      </Text>
    </View>
  );
}

function Figure({ label, value, xirr }: { label: string; value: number; xirr: number | null }) {
  const theme = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 200, gap: theme.space[1] }}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Money value={value} variant="figureSm" whole />
      <Text variant="caption" color="textSecondary">{`Return a year ${xirrText(xirr)}`}</Text>
    </View>
  );
}
