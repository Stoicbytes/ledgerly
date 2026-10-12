import { View } from 'react-native';
import { RefreshCw } from '@/components/icons';
import { Button, Text } from '@/components/ui';
import { useToast } from '@/components/feedback';
import { dayLabel } from '@/lib/domain/expenses';
import type { RefreshRun } from '@/lib/domain/investments';
import { useMarketStore } from '../state/marketStore';

const SOURCES: Record<RefreshRun['source'], string> = {
  amfi: 'AMFI',
  nse: 'NSE',
  bse: 'BSE',
  mfapi: 'history',
};

/** "NAVs as of Tue, 7 Oct (AMFI)": when the prices on screen are from, and where from. */
export function PriceStatus({ kind }: { kind: 'funds' | 'stocks' }) {
  const mode = useMarketStore((state) => state.mode);
  const runs = useMarketStore((state) => state.market.runs);
  const notice = useMarketStore((state) => state.notice);
  const sources: RefreshRun['source'][] = kind === 'funds' ? ['amfi'] : ['nse', 'bse'];
  const latest = runs
    .filter((run) => sources.includes(run.source) && run.status === 'ok' && run.dataDate)
    .sort((a, b) => (b.dataDate ?? '').localeCompare(a.dataDate ?? ''))[0];
  const what = kind === 'funds' ? 'NAVs' : 'Closing prices';
  const text =
    mode === 'preview'
      ? `${what}: sample values`
      : latest?.dataDate
        ? `${what} as of ${dayLabel(latest.dataDate, 'short')} (${SOURCES[latest.source]})`
        : `${what}: not fetched yet`;
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" color="textTertiary">
        {text}
      </Text>
      {notice ? (
        <Text variant="caption" color="textSecondary" role="status">
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

/** Asks the server for the latest NAVs and closing prices, then reloads them. */
export function RefreshPricesButton() {
  const toast = useToast();
  const refreshing = useMarketStore((state) => state.refreshing);
  const mode = useMarketStore((state) => state.mode);
  return (
    <Button
      label={refreshing ? 'Updating…' : 'Update prices'}
      variant="secondary"
      icon={RefreshCw}
      disabled={refreshing || mode === 'preview'}
      onPress={async () => {
        const message = await useMarketStore.getState().refresh();
        toast.show({ message });
      }}
    />
  );
}
