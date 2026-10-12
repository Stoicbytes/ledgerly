import { useState } from 'react';
import { View } from 'react-native';
import {
  ArrowLeftRight,
  ChartCandlestick,
  Layers,
  PiggyBank,
  Plus,
  TrendingUp,
} from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen, useFitMode } from '@/components/layout/Screen';
import { StatStrip } from '@/components/layout/StatStrip';
import { Button, Card, StatCard } from '@/components/ui';
import { PriceStatus, RefreshPricesButton } from '@/features/investments/components/PriceStatus';
import { ImportTradebookButton } from '@/features/investments/import/ImportTradebookSheet';
import { useStocksView } from '@/features/investments/hooks/useInvestments';
import { SampleDataBadge } from '@/features/preview/SampleDataBadge';
import { formatMoneyWhole, formatPercent } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { BenchmarkButton } from './benchmark/BenchmarkSheet';
import { PriceChartCard } from './PriceChartCard';
import { SectorCard } from './SectorCard';
import { StockHoldings } from './StockHoldings';
import { StockPanels, type StockPanel } from './StockPanels';
import { TopMovers } from './TopMovers';

/** Stock portfolio: one screen on desktop (panels scroll internally). */
export function StocksScreen() {
  const theme = useTheme();
  const fit = useFitMode(true);
  const [panel, setPanel] = useState<StockPanel>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const view = useStocksView();
  const { rows, totals } = view;
  const selected = rows.find((row) => row.stock.id === chosen) ?? rows[0];
  const gainPct = totals.invested ? (totals.unrealised / totals.invested) * 100 : 0;
  const dayBase = totals.value - totals.dayChange;
  const header = (
    <PageHeader
      size="compact"
      title="Stocks"
      meta={
        <View style={{ gap: theme.space[1] }}>
          <SampleDataBadge editable />
          <PriceStatus kind="stocks" />
        </View>
      }
      actions={
        <>
          <RefreshPricesButton />
          <ImportTradebookButton />
          <BenchmarkButton />
          <Button
            label="Add stock"
            icon={Plus}
            onPress={() => setPanel({ type: 'stock', stockId: null })}
          />
        </>
      }
    />
  );
  if (!selected) {
    return (
      <Screen>
        {header}
        <Card>
          <EmptyState
            icon={ChartCandlestick}
            title="Track your shares"
            body="Add a stock, then record buys, sells, dividends, bonus issues and splits. Holdings, profit and loss and XIRR follow, valued at the exchange closing price."
            action={{
              label: 'Add your first stock',
              onPress: () => setPanel({ type: 'stock', stockId: null }),
            }}
          />
        </Card>
        <StockPanels panel={panel} onChange={setPanel} />
      </Screen>
    );
  }
  return (
    <Screen fit>
      {header}
      <StatStrip
        hero={
          <StatCard
            variant="brand"
            label="Portfolio value"
            icon={ChartCandlestick}
            value={totals.value}
            delta={gainPct}
            caption="gain on cost"
            index={0}
            style={{ flex: 1 }}
          />
        }
      >
        <StatCard
          compact
          label="Invested"
          icon={PiggyBank}
          value={totals.invested}
          caption="cost of shares held"
          index={1}
          style={{ flex: 1 }}
        />
        <StatCard
          compact
          label="Unrealised P&L"
          icon={TrendingUp}
          value={totals.unrealised}
          delta={gainPct}
          caption={`${formatMoneyWhole(totals.realised + totals.dividends, 'always')} realised + dividends`}
          index={2}
          style={{ flex: 1 }}
        />
        <StatCard
          compact
          label="Day change"
          icon={ArrowLeftRight}
          value={totals.dayChange}
          delta={dayBase ? (totals.dayChange / dayBase) * 100 : 0}
          caption="since the previous close"
          index={3}
          style={{ flex: 1 }}
        />
        <StatCard
          compact
          label="XIRR"
          icon={Layers}
          value={totals.xirr === null ? '—' : formatPercent(totals.xirr * 100)}
          caption={`${totals.count} stocks held`}
          index={4}
          style={{ flex: 1 }}
        />
      </StatStrip>
      <BentoRow stackBelow="desktop" fill={fit ? 1.1 : undefined}>
        <BentoCell flex={8}>
          <PriceChartCard
            rows={rows}
            selected={selected}
            market={view.market}
            today={view.today}
            onSelect={setChosen}
            onOpen={(stockId) => setPanel({ type: 'detail', stockId })}
            style={fit ? { flex: 1 } : { height: 280 }}
          />
        </BentoCell>
        <BentoCell flex={4}>
          <SectorCard sectors={view.sectors} style={fit ? { flex: 1 } : undefined} />
        </BentoCell>
      </BentoRow>
      <BentoRow stackBelow="desktop" fill={fit ? 1 : undefined}>
        <BentoCell flex={8}>
          <StockHoldings
            rows={rows}
            selected={selected.stock.id}
            onSelect={setChosen}
            onOpen={(stockId) => setPanel({ type: 'detail', stockId })}
            style={fit ? { flex: 1 } : undefined}
          />
        </BentoCell>
        <BentoCell flex={4}>
          <TopMovers
            movers={view.movers}
            market={view.market}
            style={fit ? { flex: 1 } : undefined}
          />
        </BentoCell>
      </BentoRow>
      <StockPanels panel={panel} onChange={setPanel} />
    </Screen>
  );
}
