import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { Sparkline } from '@/components/charts';
import { ChartCandlestick, ChartPie, ChevronRight, type LucideIcon } from '@/components/icons';
import { Card, CategoryIcon, Delta, Money, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import type { OverviewData } from './useOverviewData';

export function InvestmentsSnapshot({ data, index = 7 }: { data: OverviewData; index?: number }) {
  const theme = useTheme();
  const fundGain = data.funds.invested
    ? ((data.funds.value - data.funds.invested) / data.funds.invested) * 100
    : 0;
  const stockGain = data.stocks.invested
    ? ((data.stocks.value - data.stocks.invested) / data.stocks.invested) * 100
    : 0;
  return (
    <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
      <Snapshot
        index={index}
        title="Mutual funds"
        href="/dashboard/mutual-funds"
        icon={ChartPie}
        tint={1}
        value={data.funds.value}
        delta={fundGain}
        series={data.funds.series}
      />
      <Snapshot
        index={index + 1}
        title="Stocks"
        href="/dashboard/stocks"
        icon={ChartCandlestick}
        tint={2}
        value={data.stocks.value}
        delta={stockGain}
        series={data.stocks.series}
      />
    </View>
  );
}

type SnapshotProps = {
  title: string;
  href: string;
  icon: LucideIcon;
  tint: number;
  value: number;
  delta: number;
  series: number[];
  index: number;
};

function Snapshot({ title, href, icon, tint, value, delta, series, index }: SnapshotProps) {
  const theme = useTheme();
  return (
    <Card
      index={index}
      padding={4}
      style={{ flex: 1 }}
      onPress={() => router.push(href as Href)}
      accessibilityLabel={`Open ${title}`}
    >
      <View style={{ gap: theme.space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <CategoryIcon icon={icon} tint={tint} size={30} />
          <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </Text>
          <ChevronRight size={16} color={theme.colors.textTertiary} />
        </View>
        <Money value={value} variant="title" numeric numberOfLines={1} adjustsFontSizeToFit />
        <Delta value={delta} variant="pill" comparison="total return" />
        <Sparkline values={series} height={34} />
      </View>
    </Card>
  );
}
