import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { TrendLineChart } from '@/components/charts';
import { Button, Card, Delta, Money, SegmentedControl, Text } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { addDays, dayLabel } from '@/lib/domain/expenses';
import { stockPriceSeries, type MarketData, type StockRow } from '@/lib/domain/investments';
import { formatMoney, formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { TickerBadge } from './TickerBadge';

type Range = '1M' | '3M' | '1Y';
const DAYS: Record<Range, number> = { '1M': 31, '3M': 92, '1Y': 366 };

/** Price history of the selected holding, with a chip row to switch between holdings. */
export function PriceChartCard({
  rows,
  selected,
  market,
  today,
  onSelect,
  onOpen,
  style,
}: {
  rows: StockRow[];
  selected: StockRow;
  market: MarketData;
  today: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  style?: object;
}) {
  const theme = useTheme();
  const [range, setRange] = useState<Range>('3M');
  const { isDense } = useBreakpoint();
  const from = addDays(today, -DAYS[range]);
  const series = stockPriceSeries(selected, market).filter(([date]) => date >= from);
  const values = series.map(([, value]) => value);
  const up = values[values.length - 1] >= values[0];
  return (
    <Card index={5} style={[{ gap: theme.space[3] }, style]}>
      {isDense ? null : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.space[2] }}
          style={{ flexGrow: 0, height: 36, minHeight: 36 }}
        >
          {rows.map((row) => {
            const active = row.stock.id === selected.stock.id;
            return (
              <Pressable
                key={row.stock.id}
                role="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`Chart ${row.stock.name}`}
                onPress={() => onSelect(row.stock.id)}
                style={{
                  justifyContent: 'center',
                  height: 34,
                  paddingHorizontal: theme.space[3],
                  borderRadius: theme.radius.pill,
                  backgroundColor: active ? theme.colors.ink : theme.colors.surfaceMuted,
                }}
              >
                <Text variant="label" color={active ? 'onInk' : 'textPrimary'}>
                  {row.stock.symbol}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <TickerBadge
          ticker={selected.stock.symbol}
          tint={selected.stock.order + 1}
          size={isDense ? 32 : 44}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant={isDense ? 'bodyStrong' : 'title'} numberOfLines={1}>
            {selected.stock.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            {selected.quote ? <Money value={selected.quote.price} variant="bodyStrong" /> : null}
            {selected.dayChangePct ? (
              <Delta value={selected.dayChangePct} variant="pill" comparison="today" />
            ) : null}
          </View>
        </View>
        <Button
          label="Details"
          variant="secondary"
          size="sm"
          onPress={() => onOpen(selected.stock.id)}
        />
        <SegmentedControl
          size="sm"
          fill={false}
          accessibilityLabel="Range"
          value={range}
          onChange={setRange}
          segments={[
            { value: '1M', label: '1M' },
            { value: '3M', label: '3M' },
            { value: '1Y', label: '1Y' },
          ]}
        />
      </View>
      {series.length >= 2 ? (
        <TrendLineChart
          points={series.map(([date, value]) => ({
            label: dayLabel(date, 'short').replace(/^\w+, /, ''),
            value,
            name: dayLabel(date),
          }))}
          color={up ? undefined : theme.colors.expense}
          formatValue={formatMoneyWhole}
          accessibilityLabel={`${selected.stock.name} price from ${formatMoney(values[0])} to ${formatMoney(values[values.length - 1])}.`}
        />
      ) : (
        <View style={{ flex: 1, minHeight: 120, justifyContent: 'center' }}>
          <Text variant="caption" color="textTertiary" align="center">
            Price history builds up from the daily closing prices.
          </Text>
        </View>
      )}
    </Card>
  );
}
