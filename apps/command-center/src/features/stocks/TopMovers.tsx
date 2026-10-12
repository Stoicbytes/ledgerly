import { View } from 'react-native';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { Sparkline } from '@/components/charts';
import { Card, CardHeader, Delta, Text } from '@/components/ui';
import type { MarketData, StockRow } from '@/lib/domain/investments';
import { useTheme } from '@/theme';
import { TickerBadge } from './TickerBadge';

/** Holdings with the largest move since the previous close. */
export function TopMovers({
  movers,
  market,
  style,
}: {
  movers: StockRow[];
  market: MarketData;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <Card index={8} padding={4} style={[{ gap: theme.space[2] }, style]}>
      <View style={{ paddingHorizontal: theme.space[1] }}>
        <CardHeader title="Day’s movers" subtitle="Change since the previous close" />
      </View>
      <PanelScroll gap={theme.space[2]}>
        {movers.length ? null : (
          <Text variant="caption" color="textTertiary" style={{ padding: theme.space[2] }}>
            Day changes appear once closing prices have been fetched.
          </Text>
        )}
        {movers.map((row) => {
          const history = row.stock.isin ? (market.priceHistory[row.stock.isin] ?? []) : [];
          return (
            <View
              key={row.stock.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[3],
                padding: theme.space[2],
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.surfaceMuted,
              }}
            >
              <TickerBadge ticker={row.stock.symbol} tint={row.stock.order + 1} size={34} />
              <View style={{ width: 84 }}>
                <Text variant="label" numberOfLines={1}>
                  {row.stock.symbol}
                </Text>
                <Delta value={row.dayChangePct} />
              </View>
              <View style={{ flex: 1 }}>
                {history.length >= 3 ? (
                  <Sparkline
                    values={history.slice(-15).map(([, value]) => value)}
                    color={row.dayChangePct >= 0 ? undefined : theme.colors.expense}
                    height={30}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </PanelScroll>
    </Card>
  );
}
