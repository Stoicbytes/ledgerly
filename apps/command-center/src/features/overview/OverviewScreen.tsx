import { View } from 'react-native';
import { CalendarDays } from '@/components/icons';
import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Text } from '@/components/ui';
import { useDisplayName } from '@/features/auth/useDisplayName';
import { SampleDataBadge } from '@/features/preview/SampleDataBadge';
import { greeting } from '@/lib/formatting/greeting';
import { useTheme } from '@/theme';
import { CashflowCard } from './CashflowCard';
import { InvestmentsSnapshot } from './InvestmentsSnapshot';
import { KpiQuad } from './KpiQuad';
import { NetWorthCard } from './NetWorthCard';
import { RecentActivityCard } from './RecentActivityCard';
import { RemindersCard } from './RemindersCard';
import { SpendingLimitCard } from './SpendingLimitCard';
import { useOverviewData } from './useOverviewData';

/** The home screen: net worth, cash flow, spending and investments. */
export function OverviewScreen() {
  const theme = useTheme();
  const data = useOverviewData();
  const name = useDisplayName();
  // Phones: the header already greets; the date chip and description are dropped.
  const { isMobile } = useBreakpoint();
  const today = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  return (
    <Screen>
      <PageHeader
        size="hero"
        title={`${greeting()}, ${name}`}
        description="Your money at a glance: balances, cash flow, spending and investments."
        meta={<SampleDataBadge editable />}
        actions={
          isMobile ? undefined : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                height: 36,
                paddingHorizontal: theme.space[4],
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.surface,
              }}
            >
              <CalendarDays size={16} color={theme.colors.textSecondary} />
              <Text variant="label">{today}</Text>
            </View>
          )
        }
      />
      <RemindersCard />
      <BentoRow stackBelow="desktop">
        <BentoCell flex={4}>
          <NetWorthCard data={data} />
        </BentoCell>
        <BentoCell flex={4}>
          <KpiQuad data={data} />
        </BentoCell>
        <BentoCell flex={4}>
          <CashflowCard flow={data.flow} height={isMobile ? 180 : 250} />
        </BentoCell>
      </BentoRow>
      <BentoRow stackBelow="desktop">
        <BentoCell flex={4}>
          <SpendingLimitCard budget={data.budget} top={data.topCategories} />
          <InvestmentsSnapshot data={data} />
        </BentoCell>
        <BentoCell flex={8}>
          <RecentActivityCard transactions={data.recent} />
        </BentoCell>
      </BentoRow>
    </Screen>
  );
}
