import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { Card, CardHeader, Delta, Money, Text } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useInteractionState } from '@/hooks/useInteractionState';
import type { StockRow } from '@/lib/domain/investments';
import { formatMoney } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { TickerBadge } from './TickerBadge';

const columns = [
  { label: 'Stock', flex: 3 },
  { label: 'Qty', flex: 0.8 },
  { label: 'Avg', flex: 1.1 },
  { label: 'Price', flex: 1.1 },
  { label: 'Value', flex: 1.3 },
  { label: 'P&L', flex: 1.3 },
] as const;

/** Holdings; pressing a row charts it, pressing the charted row again opens its details. */
export function StockHoldings({
  rows,
  selected,
  onSelect,
  onOpen,
  style,
}: {
  rows: StockRow[];
  selected: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  style?: object;
}) {
  const theme = useTheme();
  const { isMobile } = useBreakpoint();
  return (
    <Card index={7} padding={4} style={[{ gap: theme.space[2] }, style]}>
      <View style={{ paddingHorizontal: theme.space[1] }}>
        <CardHeader title="Holdings" subtitle="Press to chart · press again for details" />
      </View>
      {isMobile ? null : (
        <View
          style={{
            flexDirection: 'row',
            gap: theme.space[3],
            paddingHorizontal: theme.space[2],
            paddingVertical: theme.space[2],
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          {columns.map((column, index) => (
            <Text
              key={column.label}
              variant="caption"
              color="textTertiary"
              uppercase
              style={{ flex: column.flex, textAlign: index === 0 ? 'left' : 'right' }}
            >
              {column.label}
            </Text>
          ))}
        </View>
      )}
      <PanelScroll gap={0}>
        {rows.map((row) => {
          const { stock, position, quote } = row;
          const active = stock.id === selected;
          const gainPct = position.invested ? (position.unrealised / position.invested) * 100 : 0;
          const right = { textAlign: 'right' as const };
          return (
            <HoverRow
              key={stock.id}
              active={active}
              label={active ? `${stock.name}, open details` : `Chart ${stock.name}`}
              onPress={() => (active ? onOpen(stock.id) : onSelect(stock.id))}
            >
              <View
                style={{
                  flex: 3,
                  minWidth: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space[3],
                }}
              >
                <TickerBadge ticker={stock.symbol} tint={stock.order + 1} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {stock.name}
                  </Text>
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {stock.symbol} · {position.quantity ? stock.sector || stock.exchange : 'Sold'}
                  </Text>
                </View>
              </View>
              {isMobile ? (
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Money value={position.value} variant="bodyStrong" />
                  <Delta value={gainPct} variant="pill" />
                </View>
              ) : (
                <>
                  <Text variant="label" numeric style={[{ flex: 0.8 }, right]}>
                    {position.quantity}
                  </Text>
                  <Text
                    variant="label"
                    color="textSecondary"
                    numeric
                    style={[{ flex: 1.1 }, right]}
                  >
                    {position.avgCost ? formatMoney(Math.round(position.avgCost)) : '—'}
                  </Text>
                  <Text variant="label" numeric style={[{ flex: 1.1 }, right]}>
                    {quote ? formatMoney(quote.price) : '—'}
                  </Text>
                  <Money value={position.value} variant="label" style={[{ flex: 1.3 }, right]} />
                  <View style={{ flex: 1.3, alignItems: 'flex-end' }}>
                    <Money value={position.unrealised} tone="auto" variant="label" />
                    <Text
                      variant="caption"
                      color={position.unrealised >= 0 ? 'profit' : 'loss'}
                      numeric
                    >
                      {gainPct >= 0 ? '▲' : '▼'} {Math.abs(gainPct).toFixed(1)}%
                    </Text>
                  </View>
                </>
              )}
            </HoverRow>
          );
        })}
      </PanelScroll>
    </Card>
  );
}

function HoverRow({
  active,
  label,
  onPress,
  children,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      {...handlers}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          paddingVertical: theme.space[2] + 2,
          paddingHorizontal: theme.space[2],
          borderRadius: theme.radius.md,
          backgroundColor: active
            ? theme.colors.accentSoft
            : hovered
              ? theme.colors.surfaceMuted
              : 'transparent',
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      {children}
    </Pressable>
  );
}
