import { useState } from 'react';
import { View } from 'react-native';
import { CalendarDays, ChartPie, Percent, PiggyBank, Plus, TrendingUp } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen, useFitMode } from '@/components/layout/Screen';
import { StatStrip } from '@/components/layout/StatStrip';
import { Button, Card, StatCard } from '@/components/ui';
import { PriceStatus, RefreshPricesButton } from '@/features/investments/components/PriceStatus';
import { ImportTradebookButton } from '@/features/investments/import/ImportTradebookButton';
import { useFundsView } from '@/features/investments/hooks/useInvestments';
import { SampleDataBadge } from '@/features/preview/SampleDataBadge';
import { amountToInput } from '@/lib/domain/expenses';
import { sipAmountOn } from '@/lib/domain/investments';
import { formatMoneyWhole, formatPercent } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { AllocationCard } from './AllocationCard';
import { FundPanels, type FundPanel } from './FundPanels';
import { InsightsButton } from './insights/InsightsSheet';
import { GrowthCard, type GrowthRange } from './GrowthCard';
import { HoldingsTable } from './HoldingsTable';
import { SipCard } from './SipCard';

/** Mutual fund tracker: one screen on desktop (panels scroll internally). */
export function MutualFundsScreen() {
  const theme = useTheme();
  const fit = useFitMode(true);
  const [range, setRange] = useState<GrowthRange>(12);
  const [panel, setPanel] = useState<FundPanel>(null);
  const view = useFundsView(range);
  const { totals, rows } = view;
  const gainPct = totals.invested ? (totals.unrealised / totals.invested) * 100 : 0;
  const header = (
    <PageHeader
      size="compact"
      title="Mutual funds"
      meta={
        <View style={{ gap: theme.space[1] }}>
          <SampleDataBadge editable />
          <PriceStatus kind="funds" />
        </View>
      }
      actions={
        <>
          <RefreshPricesButton />
          <ImportTradebookButton />
          <InsightsButton />
          <Button
            label="Add fund"
            icon={Plus}
            onPress={() => setPanel({ type: 'fund', fundId: null })}
          />
        </>
      }
    />
  );
  if (!rows.length) {
    return (
      <Screen>
        {header}
        <Card>
          <EmptyState
            icon={ChartPie}
            title="Track your mutual funds"
            body="Add a fund from the AMFI list (or by hand), then record purchases, SIPs and redemptions. Units, gains, XIRR and NAVs follow."
            action={{
              label: 'Add your first fund',
              onPress: () => setPanel({ type: 'fund', fundId: null }),
            }}
          />
        </Card>
        <FundPanels panel={panel} onChange={setPanel} />
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
            label="Current value"
            icon={ChartPie}
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
          caption={`in ${totals.count} funds`}
          index={1}
          style={{ flex: 1 }}
        />
        <StatCard
          compact
          label="Unrealised gain"
          icon={TrendingUp}
          value={totals.unrealised}
          delta={gainPct}
          caption={
            totals.dayChange ? `${formatMoneyWhole(totals.dayChange, 'always')} today` : 'on cost'
          }
          index={2}
          style={{ flex: 1 }}
        />
        <StatCard
          compact
          label="XIRR"
          icon={Percent}
          value={totals.xirr === null ? '—' : formatPercent(totals.xirr * 100)}
          caption={
            totals.xirr === null ? 'shown after a year of investing' : 'annualised, all cash flows'
          }
          index={3}
          style={{ flex: 1 }}
        />
        <StatCard
          compact
          label="Monthly SIP"
          icon={CalendarDays}
          value={view.monthlySip ? formatMoneyWhole(view.monthlySip) : '—'}
          caption={`${view.activeSips} active`}
          index={4}
          style={{ flex: 1 }}
        />
      </StatStrip>
      <BentoRow stackBelow="desktop" fill={fit ? 1 : undefined}>
        <BentoCell flex={8}>
          <GrowthCard
            series={view.series}
            range={range}
            onRange={setRange}
            style={fit ? { flex: 1 } : { height: 240 }}
          />
        </BentoCell>
        <BentoCell flex={4}>
          <AllocationCard
            title="Allocation"
            subtitle="By asset class"
            items={view.allocation.map((slice, index) => ({ ...slice, colorIndex: index }))}
            style={fit ? { flex: 1 } : undefined}
          />
        </BentoCell>
      </BentoRow>
      <BentoRow stackBelow="desktop" fill={fit ? 1.15 : undefined}>
        <BentoCell flex={8}>
          <HoldingsTable
            rows={rows}
            onOpen={(fundId) => setPanel({ type: 'detail', fundId })}
            style={fit ? { flex: 1 } : undefined}
          />
        </BentoCell>
        <BentoCell flex={4}>
          <SipCard
            funds={rows.map((row) => row.fund)}
            pending={view.pending}
            upcoming={view.upcoming}
            today={view.today}
            onRecord={({ sip, date }) =>
              setPanel({
                type: 'txn',
                fundId: sip.fundId,
                txnId: null,
                preset: {
                  kind: 'buy',
                  date,
                  amountText: amountToInput(sipAmountOn(sip, date)),
                  sipId: sip.id,
                },
              })
            }
            style={fit ? { flex: 1 } : undefined}
          />
        </BentoCell>
      </BentoRow>
      <FundPanels panel={panel} onChange={setPanel} />
    </Screen>
  );
}
