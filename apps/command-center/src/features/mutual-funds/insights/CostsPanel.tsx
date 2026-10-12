import { View } from 'react-native';
import { Money, Text } from '@/components/ui';
import { useFundsView } from '@/features/investments/hooks/useInvestments';
import { fundCosts, similarFunds } from '@/lib/domain/investments';
import { useTheme } from '@/theme';

/**
 * What the funds cost each year (from the expense ratios you entered) and funds that share
 * a category, which often hold many of the same shares.
 */
export function CostsPanel() {
  const theme = useTheme();
  const { rows } = useFundsView();
  const costs = fundCosts(rows);
  const similar = similarFunds(rows);
  return (
    <View style={{ gap: theme.space[5] }}>
      <View style={{ gap: theme.space[2] }}>
        <Text variant="title">Yearly cost</Text>
        {costs.rows.length ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space[2] }}>
              <Money value={costs.total} variant="figureSm" />
              <Text variant="caption" color="textSecondary">
                {`a year at today's value${costs.average !== null ? ` · average expense ratio ${costs.average.toFixed(2)}%` : ''}`}
              </Text>
            </View>
            {costs.rows.map(({ row, cost }) => (
              <View key={row.fund.id} style={{ flexDirection: 'row', gap: theme.space[3] }}>
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {row.fund.name}
                </Text>
                <Text variant="caption" color="textSecondary">{`${row.fund.expenseRatio}%`}</Text>
                <Money value={cost} variant="bodyStrong" />
              </View>
            ))}
          </>
        ) : (
          <Text color="textSecondary">
            Add each fund&apos;s expense ratio (Edit fund) to see what your funds cost you each
            year.
          </Text>
        )}
        {costs.missing.length && costs.rows.length ? (
          <Text variant="caption" color="textTertiary">
            {`Not counted yet: ${costs.missing.map((row) => row.fund.name).join(', ')}.`}
          </Text>
        ) : null}
      </View>
      <View style={{ gap: theme.space[2] }}>
        <Text variant="title">Similar funds</Text>
        <Text variant="caption" color="textSecondary">
          Funds in the same category choose from the same shares, so they often overlap. This is a
          hint from the category only: compare the factsheets for the real overlap.
        </Text>
        {similar.length ? (
          similar.map((group) => (
            <View key={group.category} style={{ gap: 2 }}>
              <Text variant="bodyStrong">{`${group.rows.length} ${group.category} funds`}</Text>
              <Text variant="caption" color="textSecondary">
                {group.rows.map((row) => row.fund.name).join(' · ')}
              </Text>
            </View>
          ))
        ) : (
          <Text color="textSecondary">No two funds you hold share a category.</Text>
        )}
      </View>
    </View>
  );
}
