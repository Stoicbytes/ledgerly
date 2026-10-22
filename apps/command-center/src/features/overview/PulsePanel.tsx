import { View } from 'react-native';
import { ProgressRing, Text } from '@/components/ui';
import { pct } from '@/lib/domain/insights';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import type { MonthPulse } from './insights';

/** Income kept as a ring, then where spending is heading and how long cash lasts. */
export function PulsePanel({ pulse }: { pulse: MonthPulse }) {
  const theme = useTheme();
  const rate = pulse.savingsRate;
  const ringTone =
    rate === null ? 'accent' : rate < 0 ? 'danger' : rate < 20 ? 'warning' : 'success';
  const tile = {
    flex: 1,
    minWidth: 130,
    gap: 2,
    padding: theme.space[3],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
  } as const;
  const runway = pulse.runway;
  return (
    <View style={{ flexBasis: 280, flexGrow: 1, gap: theme.space[3] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[4],
          padding: theme.space[3],
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <ProgressRing
          value={rate === null ? 0 : rate / 100}
          tone={ringTone}
          size={76}
          accessibilityLabel="Share of this month's income kept"
        >
          <Text variant="bodyStrong">{rate === null ? '–' : pct(rate)}</Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">
            {rate === null
              ? 'No income entered yet'
              : rate < 0
                ? 'Spending more than earned'
                : 'Of your income kept'}
          </Text>
          <Text variant="caption" color="textSecondary">
            {pulse.averageRate === null
              ? 'Income minus spending, so far this month.'
              : `${pct(pulse.averageRate)} on average over the last 6 months.`}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
        <View style={tile}>
          <Text variant="caption" color="textSecondary">
            Spending heading for
          </Text>
          <Text variant="figureSm">
            {pulse.projection ? money(pulse.projection.projected) : '–'}
          </Text>
          <Text variant="caption" color="textSecondary">
            {pulse.projection
              ? `${money(pulse.projection.spent)} so far`
              : 'Shown from the 5th of the month'}
          </Text>
        </View>
        <View style={tile}>
          <Text variant="caption" color="textSecondary">
            Cash would last
          </Text>
          <Text variant="figureSm" color={runway && runway.months < 3 ? 'warning' : undefined}>
            {runway ? `${runway.months.toFixed(1)} months` : '–'}
          </Text>
          <Text variant="caption" color="textSecondary">
            {runway
              ? `at ${money(runway.monthly)} a month`
              : 'Needs bank balances and past spending'}
          </Text>
        </View>
      </View>
    </View>
  );
}
