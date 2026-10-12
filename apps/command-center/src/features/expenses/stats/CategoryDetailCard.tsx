import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { TrendLineChart } from '@/components/charts';
import { ReceiptText } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Button, Card, CardHeader, CategoryIcon, Money, Text } from '@/components/ui';
import { useFitMode } from '@/components/layout/Screen';
import { monthLabel } from '@/lib/domain/expenses';
import { formatAxisMoney, formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { iconFor } from '../categoryIcons';
import { LedgerRow } from '../components/LedgerRow';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { SliceRow } from '../components/SliceRow';
import { useSliceColors } from '../sliceColors';
import { useExpenseUi } from '../state/expenseUi';
import type { StatsView } from './useStatsView';

type CategoryDetailCardProps = {
  view: StatsView;
  active: string | null;
  onHover: (label: string | null) => void;
  style?: StyleProp<ViewStyle>;
};

/** One category: its trend, its subcategories and its entries in the period. */
export function CategoryDetailCard({ view, active, onHover, style }: CategoryDetailCardProps) {
  const theme = useTheme();
  const fit = useFitMode(true);
  const accountId = useExpenseUi((state) => state.accountId);
  const colors = useSliceColors(view.subSlices);
  const focusSlice = useExpenseUi((state) => state.focusSlice);
  const category = view.drill;
  if (!category) return null;
  const focus = view.focus;
  const name = focus ? `${category.name} › ${focus.name}` : category.name;
  const total = focus ? focus.amount : view.drillTotal;
  const trendLabel =
    view.period === 'year' ? 'Each month of the year' : 'Month by month · press one to open it';
  const selected = view.trend.findIndex((point) => point.month === view.month);
  const openMonth = (index: number) =>
    // Keeps the category open while switching to that month.
    useExpenseUi.setState({ month: view.trend[index].month, statsPeriod: 'month' });
  return (
    <Card index={2} style={[{ gap: theme.space[3] }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <CategoryIcon icon={iconFor(category.icon)} tint={category.tint} size={40} />
        <View style={{ flex: 1 }}>
          <CardHeader
            title={name}
            subtitle={trendLabel}
            action={
              focus ? (
                <Button
                  label={`All ${category.name}`}
                  size="sm"
                  variant="secondary"
                  onPress={() => focusSlice(null)}
                />
              ) : null
            }
          />
        </View>
      </View>
      <TrendLineChart
        height={fit ? 150 : 170}
        color={theme.colors.pie[1]}
        selected={view.period === 'month' ? selected : undefined}
        onSelect={openMonth}
        points={view.trend.map((point, index) => ({
          label: monthLabel(point.month, 'short'),
          sublabel:
            index === 0 || point.month.endsWith('-01') ? point.month.slice(0, 4) : undefined,
          value: point.amount,
          name: monthLabel(point.month),
        }))}
        formatValue={(value) => (value >= 1e7 ? formatAxisMoney(value) : formatMoneyWhole(value))}
        accessibilityLabel={`${name} by month: ${view.trend
          .map((point) => `${monthLabel(point.month, 'short')} ${formatMoneyWhole(point.amount)}`)
          .join(', ')}.`}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: theme.space[2],
          paddingHorizontal: theme.space[3],
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <Text variant="label" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
          {name} · {view.periodLabel}
        </Text>
        <Money value={total} whole variant="bodyStrong" />
      </View>
      {view.entries.length ? (
        <PanelScroll>
          {view.subSlices.length > 1 ? (
            <>
              {view.subSlices.map((slice, index) => (
                <SliceRow
                  key={slice.id}
                  slice={slice}
                  color={colors[index]}
                  active={active === slice.name || focus?.id === slice.id}
                  selected={focus?.id === slice.id}
                  onHover={onHover}
                  onPress={() => focusSlice(slice.id)}
                />
              ))}
            </>
          ) : null}
          <Text variant="eyebrow" color="textTertiary" uppercase style={{ marginTop: 8 }}>
            Entries · {view.entries.length}
          </Text>
          {view.entries.map((transaction) => (
            <LedgerRow
              key={transaction.id}
              transaction={transaction}
              accountId={accountId}
              showDate
            />
          ))}
        </PanelScroll>
      ) : (
        <EmptyState
          icon={ReceiptText}
          title="No entries in this period"
          body={`Nothing was recorded under ${name} in ${view.periodLabel}.`}
        />
      )}
    </Card>
  );
}
